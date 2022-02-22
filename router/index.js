// Imports
import { init, resolveDistPath, config, logger, internalCookieRx } from '../lib/env.js'
import express from 'express'
import vhost from './middleware/vhost.js'
import proxy from './middleware/proxy.js'
import Session from '../lib/session.js'
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
			name => !internalCookieRx.test(name)
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
		express.static(resolveDistPath('ysyx'))
	))
	// DOCS
	.use(vhost(
		/^docs.ysyx.(org|cc|dev|local)$/i,
		express.static(resolveDistPath('ysyx.docs'))
	))
	// SPACE
	.use(vhost(
		/^space.ysyx.(org|cc|dev|local)$/i,
		express.static(resolveDistPath('ysyx.space'))
	))
	// FORUM
	.use(vhost(
		/^forum.ysyx.(org|cc|dev|local)$/i,
		express().disable('x-powered-by').use(
			// Session preprocessor
			Session.preprocessor,
			// Forward processed traffic to real NodeBB service
			proxy(req => ({
				hostname: '127.0.0.1',
				port: config?.port?.NodeBB || 4567,
				path: req.url,
				method: req.method,
				headers: req.headers
			}))
		)
	))
	// API server
	.use(vhost(
		/^api.ysyx.(org|cc|dev|local)$/i,
		express().use(
			// Session preprocessor
			Session.preprocessor,
			// Forward processed traffic to real NodeBB service
			proxy(req => ({
				hostname: '127.0.0.1',
				port: config?.port?.api || 8999,
				path: req.url,
				method: req.method,
				headers: req.headers
			}))
		)
	))
	// Uncaught Request handler
	.use((req, res) => {
		res.status(404)
		logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
		// respond with html page
		if (req.accepts('html')) {
			res.render('404', { url: req.url })
			return
		}
		// fallback to plain-text
		else res.type('txt').send('404 Not found')
	})
	// Open listening port
	.listen(port, () => logger.info(`Service up and running at port ${port}`))