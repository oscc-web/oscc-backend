// Import code modules
import { init, resolveDistPath, config, logger } from '../lib/env.js'
import '../lib/extendHttp.js'
import vhost from './middleware/vhost.js'
// Import package modules
import express from 'express'
import proxy from './middleware/proxy.js'
// Extract related configs from user config
const port = config?.port?.router || 80
// Environment setup
init(import.meta)
// Boot-up log
logger.info(`YSYX backend services launched at [${config.mode}] mode`)
// Compose the server
express()
	// Preprocessor and access logger
	.use((req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		// Filter request cookies specified by stripeCookiePrefix
		// these cookies are likely to be used internally,
		// and should never be passed through to application servers
		req.filterCookies(name => !config.stripeCookiePrefix.test(name))
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
		proxy(req => {
			// // Verify if visitor has an active session 
			// let sessionToken = Session.verify(req)
			// // Inject user info into the request if session is active
			// if (sessionToken) Session.injectSessionToken(req, sessionToken)
			// Rewrite target
			return {
				hostname: '127.0.0.1',
				port: config?.port?.NodeBB || 4567,
				path: req.url,
				method: req.method,
				headers: req.headers
			}
		})
	))
	// Deploy server
	.use(vhost(
		/^deploy.ysyx.(org|cc|dev|local)$/i,
		express.static(resolveDistPath('ysyx'))
	))
	// Uncaught Request handler
	.use((req, res) => {
		res.sendStatus(404)
		logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
	})
	// Open listening port
	.listen(port, () => logger.info(`service up and running at port ${port}`))