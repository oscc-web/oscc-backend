// Imports
import { CustomError, InvalidOperationError, PrivilegeError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
import withSession from 'lib/middleware/withSession.js'
// Libraries and utilities
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
// Local dependencies
import getGroupsList from './get-list.js'
import { create, remove, update } from './operations.js'
import { PRIV } from 'lib/privileges.js'
// Privilege Checker
async function checkPrivilege(req, user) {
	if (!await user.hasPriv(PRIV.ALTER_GROUP_PRIVILEGES)) throw new PrivilegeError(
		'Alter groups', { user, ...req }
	)
}
// Compose the server
const server = express()
	.use(
		withSession(
			express.json(),
			wrap(async (req, res) => {
				const { url, body } = req, user = await req.session?.user
				logger.debug(`${user} requesting ${JSON.stringify({ url, body })}`)
				switch (url.toLowerCase()) {
					case '/':
						res.json(await getGroupsList(user))
						break
					case '/create':
						await checkPrivilege(req, user);
						(await create(body, user))(res)
						break
					case '/update':
						await checkPrivilege(req, user);
						(await update(body, user))(res)
						break
					case '/remove':
						await checkPrivilege(req, user);
						(await remove(body, user))(res)
						break
					default:
						throw new InvalidOperationError(url, { user })
				}
			}, 'groupsRequestRouter')
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
