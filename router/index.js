// Imports
import { init, resolveDistPath, config, logger, Rx, IS_DEVELOPMENT_MODE } from '../lib/env.js'
import express from 'express'
// Middleware
import vhost from './middleware/vhost.js'
import proxy from './middleware/proxy.js'
import privileged from './middleware/privileged.js'
import errorHandler from './middleware/errorHandler.js'
// Strategies
import home from './strategies/home.js'
import forumPreprocessor from './strategies/forum.js'
// Libraries
import Session from '../lib/session.js'
import { PRIV } from '../lib/privileges.js'
import statusCode from '../lib/status.code.js'
// Standard error handler

// Extract related configs from user config
const port = config?.port?.router || 8080
// Environment setup
init(import.meta)
// Boot-up log
logger.info(`YSYX backend services launched at [${config.mode}] mode`)
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
		(IS_DEVELOPMENT_MODE && config.port.vite)
			// Forward traffic to vite dev server
			? (() => {
				logger.info(`YSYX.ORG redirected to development port [${config.port.vite}]`)
				return proxy(req => ({
					hostname: '127.0.0.1',
					port: config.port.vite
				}))
			})()
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
		// Session preprocessor
		Session.preprocessor,
		// Privileged access filter
		privileged(PRIV.DOCS_PRIVATE_ACCESS, {
			activeCond: req => /^\/?(private|internal)/i.test(req.url)
		}),
		// Static file server
		express.static(resolveDistPath('ysyx.docs'))
	))
	// SPACE
	.use(vhost(
		/^space.ysyx.(org|cc|dev|local)$/i,
		// Session preprocessor
		Session.preprocessor,
		// Static file server
		express.static(resolveDistPath('ysyx.space'))
	))
	// FORUM
	.use(vhost(
		/^forum.ysyx.(org|cc|dev|local)$/i,
		forumPreprocessor,
		// Forward processed traffic to real NodeBB service
		proxy(() => ({
			hostname: '127.0.0.1',
			port: config?.port?.NodeBB || 4567
		}))
	))
	// API server
	.use(vhost(
		/^api.ysyx.(org|cc|dev|local)$/i,
		express().use(
			// Session preprocessor
			Session.preprocessor,
			// Forward processed traffic to real NodeBB service
			proxy(() => ({
				hostname: '127.0.0.1',
				port: config?.port?.api || 8999
			}))
		)
	))
	// Uncaught request handler
	.use((req, res) => {
		logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
		res.status(statusCode.ClientError.NotFound).end()
	})
	// Request error handler
	.use(errorHandler)
	// Open listening port
	.listen(port, () => logger.info(`Service up and running at port ${port}`))