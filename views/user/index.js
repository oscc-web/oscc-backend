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
import { viewUserProfile, updateMail, getUserAvatar, updateUserPassword, updateUserProfile, updateGroups } from './operations.js'
import User from 'lib/user.js'
const server = express()
	.use(
		withSession(),
		express.json(),
		wrap(async (req, res) => {
			const { url, body } = req, operatingUser = await req.session?.user,
				[userID, action = '', ...search] = url.split(/\/|\?|&/gi).splice(1),
				targetUser = await User.locate(userID)
			logger.debug(`${
				operatingUser || 'GuestUser <>'
			} requesting ${
				JSON.stringify({ action, userID })
			}`)
			switch (action.toLowerCase()) {
				case '':
					res.json(await viewUserProfile(operatingUser, userID))
					break
				case 'profile':
					(await updateUserProfile(operatingUser, body))(res)
					break
				case 'mail':
					(await updateMail(operatingUser, body))(res)
					break
				case 'password':
					(await updateUserPassword(operatingUser, body))(res)
					break
				case 'groups':
					(await updateGroups(operatingUser, targetUser, body))(res)
					break
				case 'avatar':
					(await getUserAvatar(userID, search))(res)
					break
				default:
					throw new InvalidOperationError(
						action,
						{
							user: operatingUser,
							url
						}
					)
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
