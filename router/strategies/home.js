import express from 'express'
import bodyParser from 'body-parser'
import User from 'lib/user.js'
import logger from 'lib/logger.js'
import statusCode from 'lib/status.code.js'
import { config, Rx } from 'lib/env.js'
import { AppData } from 'lib/appData.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import wrap from 'utils/wrapAsync.js'
import withSession from 'lib/middleware/withSession.js'
import conditional from 'lib/middleware/conditional.js'
import pathMatch from 'lib/middleware/pathMatch.js'
import proxy from 'lib/middleware/proxy.js'
import Resolved from 'utils/resolved.js'
import { CustomError } from 'lib/errors.js'
/**
 * Server instance
 */
const server = express()
	// Groups View
	.use(
		pathMatch
			.POST('/groups', proxy(new Resolved('$groups').resolver))
			.stripped
	)
	// User View
	.use(conditional(
		({ method, url }) => {
			const [prefix, userID, action, ...segments] = url.split('/').splice(1)
			if (prefix !== 'user' || !userID) return
			if (method !== 'POST' && action !== 'avatar') return
			return { url: ['', userID, action, ...segments].join('/') }
		},
		proxy(new Resolved('$user').resolver)
	))
	// Auth view
	.use(pathMatch.POST(/\/(login|logout|register|auth)/ig,
		proxy(new Resolved('$auth').resolver)
	))
	// Standard error handler
	.use(CustomError.handler)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)
