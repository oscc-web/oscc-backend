// Environmental setup
import { CustomError, InvalidOperationError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import withSession from 'lib/middleware/withSession.js'
import pathMatch from 'lib/middleware/pathMatch.js'
// Libraries and utilities
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
import { viewUserProfile, updateMail, getUserAvatar, updateUserPassword, updateUserProfile, updateInstitution } from './operations.js'
const server = express()
	.use(
		withSession(),
		express.json(),
		wrap(async (req, res) => {
			const { url, body } = req, user = await req.session?.user
			const [userID, action = '', ...search] = url.split(/\/|\?|&/gi).splice(1)
			logger.debug(`${user} requesting ${JSON.stringify({ action, userID })}`)
			switch (action.toLowerCase()) {
				case '':
					res.json(await viewUserProfile(user, userID))
					break
				case 'update-profile':
					(await updateUserProfile(user, body))(res)
					break
				case 'update-mail':
					(await updateMail(user, body))(res)
					break
				case 'update-password':
					(await updateUserPassword(user, body))(res)
					break
				case 'avatar':
					(await getUserAvatar(userID, search))(res)
					break
				case 'institution':
					(await updateInstitution(user.userID, body))(res)
					break
				default:
					throw new InvalidOperationError(action, { user, url })
			}
		}, 'userRequestRouter'),
		// Uncaught request handler
		(req, res) => {
			// Only update statusCode if it has not been modified
			if (res.statusCode === statusCode.Success.OK) {
				logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
				res.status(statusCode.ClientError.NotFound)
			}
			res.end()
		}
	)
// Request error handler
	.use(CustomError.handler)
// Remove express powered-by header
	.disable('x-powered-by')
// Launch server
Resolved.launch(server)
