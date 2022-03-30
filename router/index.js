// Imports
import { resolveDistPath, config, Rx, Args } from 'lib/env.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import vhost from 'lib/middleware/vhost.js'
import proxy from 'lib/middleware/proxy.js'
import withSession from 'lib/middleware/withSession.js'
import errorHandler from 'utils/errorHandler.js'
// Strategies
import home from './strategies/home.js'
import docs from './strategies/docs.js'
import forum from './strategies/forum.js'
// Libraries
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
import { WebsocketResponse } from 'utils/wsResponse.js'
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
		let filteredCookies = req.filterCookies(
			name => !Rx.internalCookie.test(name)
		)
		if (filteredCookies.length) logger.errAcc(
			'Internal cookies found in request, will be removed',
			filteredCookies
		)
		// Pass down the request
		next()
	})
	// YSYX.ORG
	.use(vhost(
		/^ysyx\.(org|cc|dev|local)$/i,
		// Routing strategy
		home,
		// Static server can be either a static dist or vite dev server
		(Args.useDevProxy)
			// Forward traffic to vite dev server
			? (() => {
				logger.info(`YSYX.ORG redirected to development port [${config.devProxy['@']}]`)
				return proxy(config.devProxy['@'])
			})()
			// Static file server
			// eslint-disable-next-line spellcheck/spell-checker
			: express.static(resolveDistPath('ysyx')),
		// Serve index.html
		async (req, res, next) => {
			try {
				return await new Promise((resolve, reject) => {
					res.sendFile(
						'./index.html',
						{ root: resolveDistPath('ysyx') },
						e => {
							if (e instanceof Error) reject(e)
							else resolve()
						})
				})
			} catch (e) {
				next(e)
			}
		}
	))
	// DOCS
	.use(vhost(/^docs\.ysyx\.(org|cc|dev|local)$/i, docs))
	// FORUM
	.use(vhost(/^forum\.ysyx\.(org|cc|dev|local)$/i, forum))
	// SPACE
	.use(vhost(
		/^space\.ysyx\.(org|cc|dev|local)$/i,
		// Session preprocessor
		withSession(),
		// Static file server
		express.static(resolveDistPath('ysyx.space'))
	))
	// UPLOAD
	.use(vhost(
		/^upload\.ysyx\.(org|cc|dev|local)$/i,
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
	.use(errorHandler)
// Launch server
Resolved.launch(server).then(httpServer => {
	if (httpServer) httpServer.on('upgrade', (req, socket, head) => {
		const { headers: { host, connection, upgrade }, url, method } = req
		server.handle(req, new WebsocketResponse(req, socket, head), () => {
			socket.close('No handler for this request')
		})
	})
})
