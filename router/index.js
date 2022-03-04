// Imports
import { init, resolveDistPath, config, logger, Rx } from '../lib/env.js'
import express from 'express'
import jsonwebtoken from 'jsonwebtoken'
// Middleware
import vhost from './middleware/vhost.js'
import proxy from './middleware/proxy.js'
import privileged from './middleware/privileged.js'
// Strategies
import home from './strategies/home.js'
// Libraries
import Session from '../lib/session.js'
import { PRIV } from '../lib/privileges.js'
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
		// Static file server
		express.static(resolveDistPath('ysyx')),
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
		express().disable('x-powered-by').use(
			// Session preprocessor
			Session.preprocessor,
			async (req, res, next) => {
				const session = await Session.locate(req)
				const header = {
					'alg': 'HS256',
					'typ': 'JWT'
				}
				const userInfo = JSON.parse(session.userInfoString)
				const secret = config.nodebb.secret
				if (!(session instanceof Session)) {
					return next()
				}
				req.injectCookies({
					token: jsonwebtoken.sign(Object.assign({ id: session.userID }, userInfo), secret, { header })
				})
				next()
			},
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
		// if (req.accepts('html')) {
		// res.render('404', { url: req.url })
		// return
		// }
		// fallback to plain-text
		// else
		res.type('txt').send('404 Not found')
	})
	// Open listening port
	.listen(port, () => logger.info(`Service up and running at port ${port}`))