// Environmental setup
import { CustomError, InvalidOperationError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
// Libraries and utilities
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
import { searchUserByID, searchUserByGroups, searchUserByInstitution, sortUserByName } from './operations.js'
const server = express()
	.use(
		express.json(),
		wrap(async (req, res) => {
			await searchUserByID(req.body, undefined)
				.then(result => searchUserByGroups(req.body, result))
				.then(result => searchUserByInstitution(req.body, result))
				.then(result => sortUserByName(req.body, result))
				.then(result => res.json(result.map(user => user._id)))
		}, 'userSearcherRequestRouter'),
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
