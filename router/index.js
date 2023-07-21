// Imports
import { config, Rx, Args, DOMAIN } from 'lib/env.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import vhost from 'lib/middleware/vhost.js'
import proxy from 'lib/middleware/proxy.js'
import pathMatch from 'lib/middleware/pathMatch.js'
// Strategies
import home from './strategies/home.js'
import docs from './strategies/docs.js'
import forum from './strategies/forum.js'
// Libraries
import statusCode from 'lib/status.code.js'
import Deployer from 'lib/deployer.js'
import { CustomError } from 'lib/errors.js'
import Resolved from 'utils/resolved.js'
import { WebsocketResponse } from 'utils/wsResponse.js'
// Server regexp composer
const $ = ([str]) => new RegExp(`^${str && `${str}\\.` || ''}(OSCC\\.)?(CC|ORG|DEV|LOCAL|TEST)$`, 'i')
// Compose the server
const server = express()
	// Remove express powered-by header
	.disable('x-powered-by')
	// Preprocessor and access logger
	.use((req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		// Filter request cookies specified by stripeCookiePrefix
		// these cookies are likely to be used internally,
		// and should never be passed through to application servers
		const filteredCookies = req.filterCookies(
			name => !Rx.internalCookie.test(name)
		)
		if (filteredCookies.length) logger.errAcc(
			'Internal cookies found in request, will be removed',
			filteredCookies
		)
		// Pass down the request
		next()
	})
	// OSCC.CC
	.use(vhost(
		$``,
		new Deployer('oscc', true).server
	))
	// JEMU.OSCC.CC
	.use(vhost(
		$`JEMU`,
		new Deployer('jemu', true).server
	))
	// eslint-disable-next-line capitalized-comments
	// iEDA.OSCC.CC
	.use(vhost(
		$`iEDA`,
		new Deployer('iEDA-docs', true).server
	))
	// OSEDA.OSCC.CC
	.use(vhost(
		$`OSEDA`,
		new Deployer('oseda', true).server
	))
	// YSYX.ORG
	.use(vhost(
		$`YSYX`,
		// FORUM
		pathMatch('/forum/', forum),
		// DOCS
		pathMatch('/docs/', docs).stripped,
		// DOCS
		pathMatch('/slides/', new Deployer('ysyx-slides').server).stripped,
		// Routing strategy
		home,
		// Static server can be either a static dist or vite dev server
		Args.useDevProxy
			// Forward traffic to vite dev server
			? (() => {
				logger.info(`YSYX.ORG redirected to development port [${config.devProxy['@']}]`)
				return proxy(config.devProxy['@'])
			})()
			// Static file server
			: new Deployer('home', true).server
	))
	// DOCS
	.use(vhost(
		$`DOCS.YSYX`,
		({ url }, res) => res.redirect(`http://${DOMAIN}/docs${url}`)
	))
	// UPLOAD
	.use(vhost(
		$`UPLOAD.YSYX`,
		proxy(new Resolved('@upload', false).resolver)
	))
	// Uncaught request handler
	.use((req, res) => {
		// Only update statusCode if it has not been modified
		if (res.statusCode === statusCode.Success.OK) {
			logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
			res.status(statusCode.ClientError.NotFound)
		}
		res.end()
	})
	// Request error handler
	.use(CustomError.handler)
// Launch server
Resolved.launch(server).then(httpServer => {
	if (httpServer) httpServer.on('upgrade', (req, socket, head) => {
		const { headers: { host, connection, upgrade }, url, method } = req
		server.handle(req, new WebsocketResponse(req, socket, head), () => {
			socket.close('No handler for this request')
		})
	})
})
