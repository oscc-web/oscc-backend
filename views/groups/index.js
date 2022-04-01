// Imports
import { config } from 'lib/env.js'
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
// Local dependencies
import getGroupsList from './get-list.js'
import { create, remove, update } from './operations.js'
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
						(await create(body, user))(res)
						break
					case '/update':
						(await update(body, user))(res)
						break
					case '/remove':
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
