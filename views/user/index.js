// Environmental setup
import { config, TODO } from 'lib/env.js'
import { CustomError, InvalidOperationError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import vhost from 'lib/middleware/vhost.js'
import proxy from 'lib/middleware/proxy.js'
import withSession from 'lib/middleware/withSession.js'
import pathMatch from 'lib/middleware/pathMatch.js'
// Libraries and utilities
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
import { getUserAvatar } from './avatar.js'
import { updateUserPassword } from './updatePassword.js'
import { updateMail } from './updateMail.js'
import { viewUserProfile } from './profile.js'
import { updateUserProfile } from './profile.js'
const server = express()
	.use(
		withSession(
			express.json(),
			pathMatch(/^\/users\/?/, wrap(async (req, res) => {
				const { pathMatch: { url }, body } = req, user = await req.session?.user
				const [action, uid] = url.split('/', 2)
				logger.debug(`${user} requesting ${JSON.stringify({ action, uid })}`)
				switch (action.toLowerCase()) {
					case '':
						res.json(await viewUserProfile(user, uid))
						break
					case 'updateProfile':
						TODO()
						break
					case 'updateMail':
						(await updateMail(user, body))(res)
						break
					case 'updatePassword':
						TODO()
						break
					case 'avatar':
						(await getUserAvatar(uid))(res)
						break
					default:
						throw new InvalidOperationError(action, { user, url })
				}
			}, 'groupsRequestRouter')),
			// Uncaught request handler
			(req, res) => {
			// Only update statusCode if it has not been modified
				if (res.statusCode === statusCode.Success.OK) {
					logger.errAcc(`Unable to handle request ${req.headers.host}${req.url} from ${req.origin}`)
					res.status(statusCode.ClientError.NotFound)
				}
				res.end()
			}
		).otherwise(
			({ method, url, origin }, res) => {
				logger.errAcc(`Rejected ${method} ${url} from ${origin}: no session found`)
				res.status(statusCode.ClientError.Unauthorized).end()
			}
		)
	)
// Request error handler
	.use(CustomError.handler)
// Remove express powered-by header
	.disable('x-powered-by')
// Launch server
Resolved.launch(server)
