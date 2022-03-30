// Environmental setup
import { resolveDistPath, config, Rx, Args } from 'lib/env.js'
import logger from 'lib/logger.js'
import express from 'express'
import { contentDir, AppDataWithFs } from 'lib/appDataWithFs.js'
import statusCode from 'lib/status.code.js'
import withSession from 'lib/middleware/withSession.js'
import privileged from 'lib/middleware/privileged.js'
import conditional from 'lib/middleware/conditional.js'
import Resolved from 'utils/resolved.js'
import { getUserAvatar } from './avatar.js'
import { updateUserPassword } from './updatePassword.js'
import { updateMail } from './updateMail.js'
import { viewUserProfile } from './profile.js'
import { updateUserProfile } from './profile.js'

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
	// get :userID and push it into request
	.use(conditional(({ url }) => {
		if (url.startsWith('/user/')) {
			let userID = ((url.match(/^(\/user\/)\w*(?=\/)/g))[0]).replace('/user/', '')
			url = url.replace(/^\/user\/(.*?)\/?/g, '')
			return {
				userID,
				url: url.split(userID)[1]
			}
		}
	}),
	withSession().otherwise((req, res, next) => {
		logger.errAcc(`Session not found (requesting ${req.headers.host}${req.url} from ${req.origin})`)
		res.status(statusCode.ClientError.Unauthorized).end()
	}),
	async (req, res, next) => {
		next()
	})
	// Get user's avatar
	.use(conditional(({ url, method }) => url === '/avatar',
		conditional(({ method }) =>
			method === 'GET'
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		}),
		async (req, res, next) => {
			await getUserAvatar(req, res, next)
		})
	)
	// View user's profile
	.use(conditional(({ url, method }) => url === '/',
		conditional(({ method }) =>
			method === 'POST'
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		}),
		async (req, res, next) => {
			await viewUserProfile(req, res, next)
		})
	)
	// Update user's mail
	.use(conditional(({ url, method }) => url === '/updateMail',
		conditional(({ method }) =>
			method === 'POST'
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		}),
		async (req, res, next) => {
			await updateMail(req, res, next)
		})
	)
	// Update user's profile
	.use(conditional(({ url, method }) => url === '/update',
		conditional(({ method }) =>
			method === 'POST'
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		}),
		async (req, res, next) => {
			await updateUserProfile(req, res, next)
		}))
	// Update user's password
	.use(conditional(({ url, method }) => url === '/updatePassword',
		conditional(({ method }) =>
			method === 'POST'
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		}),
		async (req, res, next) => {
			await updateUserPassword(req, res, next)
		})
	)
// Launch server
Resolved.launch(server)