// Imports
import { resolveDistPath, config, Rx, Args } from '../lib/env.js'
import logger from '../lib/logger.js'
import express from 'express'
// Middleware
import vhost from '../lib/middleware/vhost.js'
import proxy from '../lib/middleware/proxy.js'
import privileged from '../lib/middleware/privileged.js'
import errorHandler from '../utils/errorHandler.js'
// Strategies
import home from './strategies/home.js'
import forumPreprocessor from './strategies/forum.js'
// Libraries
import Session from '../lib/session.js'
import { PRIV } from '../lib/privileges.js'
import statusCode from '../lib/status.code.js'
import conditional from '../lib/middleware/conditional.js'
import withSession from '../lib/middleware/withSession.js'
import Resolved from '../utils/resolved.js'
// Standard error handler

// Extract related configs from user config
const port = Args.port || config.port || 8000
// Compose the server
express()
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
		/^ysyx.(org|cc|dev|local)$/i,
		// Routing strategy
		home,
		// Static server can be either a static dist or vite dev server
		(Args.useDevProxy)
			// Forward traffic to vite dev server
			? (
				logger.info(`YSYX.ORG redirected to development port [${config.devProxy['@']}]`),
				proxy(config.devProxy['@'])
			)
			// Static file server
			: express.static(resolveDistPath('ysyx')),
		// Serve index.html
		async (req, res, next) => {
			try {
				return await new Promise((resolve, reject) => {
					res.sendFile(
						'index.html',
						{ root: resolveDistPath('ysyx') },
						e => {
							if (e instanceof Error) return reject(e)
							resolve()
						})
				})
			} catch (e) {
				logger.error('Cannot find index.html for root PWA')
				return next()
			}
		}
	))
	// DOCS
	.use(vhost(
		/^docs.ysyx.(org|cc|dev|local)$/i,
		// Privileged access filter
		conditional(
			({ url }) => url.startsWith('/private') || url.startsWith('/internal'),
			privileged(
				PRIV.DOCS_PRIVATE_ACCESS, {},
				express.static(resolveDistPath('ysyx.docs'))
			)
		).otherwise(
			// Static file server
			express.static(resolveDistPath('ysyx.docs'))
		)
	))
	// SPACE
	.use(vhost(
		/^space.ysyx.(org|cc|dev|local)$/i,
		// Session preprocessor
		withSession(),
		// Static file server
		express.static(resolveDistPath('ysyx.space'))
	))
	// FORUM
	.use(vhost(
		/^forum.ysyx.(org|cc|dev|local)$/i,
		withSession(),
		forumPreprocessor,
		// Forward processed traffic to real NodeBB service
		proxy(config?.port?.NodeBB || 4567 )
	))
	// API server
	.use(vhost(
		/^upload.ysyx.(org|cc|dev|local)$/i,
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
	// Open listening port
	.listen(port, () => logger.info(`Service up and running at port ${port}`))