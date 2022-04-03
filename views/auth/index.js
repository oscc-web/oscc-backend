// Imports
import { CustomError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import withSession from 'lib/middleware/withSession.js'
import Session, { SESSION_TOKEN_NAME } from 'lib/session.js'
// Libraries and utilities
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
// Local dependencies
import loginRequestHandler from './login.js'
import { success } from './response.js'
import registerRequestHandler from './register.js'
// Compose the server
const server = express()
	.post('/login',
		express.json(),
		withSession(),
		wrap(async (req, res) => await (await loginRequestHandler(req))(res))
	)
	.post('/register',
		express.json(),
		wrap(async (req, res) => await (await registerRequestHandler(req))(res))
	)
	.post('/logout', withSession(wrap(async (req, res) => {
		const { session } = req
		if (session instanceof Session) {
			logger.access(`User <${session.userID}> logged out`)
			session.drop()
		}
		success(res)
	})))
	// Request error handler
	.use(CustomError.handler)
	// Remove express powered-by header
	.disable('x-powered-by')
// Launch server
Resolved.launch(server)
