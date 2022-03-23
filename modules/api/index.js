import express, { response } from 'express'
import { config, PROJECT_ROOT } from '../../lib/env.js'
import { AppDataWithFs } from '../../lib/appDataWithFs.js'
import bodyParser from 'body-parser'
import statusCode from '../../lib/status.code.js'
import logger from '../../lib/logger.js'
import errorHandler from '../../utils/errorHandler.js'
import Resolved from '../../utils/resolved.js'
import withSession from '../../lib/middleware/withSession.js'
import conditional from '../../lib/middleware/conditional.js'
logger.info('Staring api server')
let appDataWithFs = new AppDataWithFs()
const server = express()
server.use(
	conditional(({ method }) => method == 'POST' || method == 'GET',
		withSession().otherwise((req, res, next) => {
			logger.errAcc(`Session not found (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.Unauthorized).end()
		})
	).otherwise((req, res, next) => {
		logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
		res.status(statusCode.ClientError.MethodNotAllowed).end()
	})
)
server.post('/user/avatar',
	bodyParser.json(),
	async (req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		const { session } = req, user = await session.user
		appDataWithFs
			.acquireFile({ user: JSON.stringify(user), action: '/avatar', fileID: req.body.fileID })
			.then(async result => {
				if (result.modifiedCount > 0) {
					await appDataWithFs.update({ user: JSON.stringify(user), action: '/avatar', fileID: req.body.fileID }, { $set:{ 'content.mTime': new Date() } })
					logger.access(`Acquire file ${req.body.fileID} by ${user} from ${req.origin}`)
				} else {
					logger.errAcc(`No suitable file can be acquired located by ${user} fileID <${req.body.fileID}>`)
				}
				res.status(statusCode.Success.OK).end(JSON.stringify(result))
			}).catch(e => {
				logger.errAcc(`File accquired error: ${e.stack}`)
				res.sendStatus(statusCode.ServerError.InternalServerError)
			})
	})
	.get('/user/avatar',
		async (req, res, next) => {
			logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
			const { session } = req, user = await session.user,
				fileID = req.query?.fileID
			appDataWithFs
				.loadFile({ user: JSON.stringify(user), action: '/avatar', fileID })
				.then(async fileDescriptor => {
					if (!fileDescriptor) return res.sendStatus(statusCode.ClientError.NotFound)
					fileDescriptor.pipe(res)
					await appDataWithFs.update({ user: JSON.stringify(user), action: '/avatar', fileID }, { $set:{ 'content.cTime': new Date() } })
					logger.access(`send file ${fileID} to <${req.origin}>`)
				})
				.catch(e => {
					logger.errAcc(`Can not get ${user}'s file ${fileID}: ${e.stack}`)
					res.sendStatus(statusCode.ServerError.InternalServerError)
				})
		})
Resolved.launch(server)
