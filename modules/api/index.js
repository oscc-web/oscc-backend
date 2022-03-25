import express from 'express'
import { AppDataWithFs } from '../../lib/appDataWithFs.js'
import statusCode from '../../lib/status.code.js'
import logger from '../../lib/logger.js'
import Resolved from '../../utils/resolved.js'
import withSession from '../../lib/middleware/withSession.js'
import conditional from '../../lib/middleware/conditional.js'
logger.info('Staring api server')
let appDataWithFs = new AppDataWithFs('user-profile')
const server = express()
server.use(
	// filter method, POST and GET are allowd
	conditional(({ method }) => method == 'POST' || method == 'GET',
		// filer user not login
		withSession().otherwise((req, res, next) => {
			logger.errAcc(`Session not found (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.Unauthorized).end()
		})
	).otherwise((req, res, next) => {
		logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
		res.status(statusCode.ClientError.MethodNotAllowed).end()
	})
)
// load file
server.get('/avatar',
	async (req, res, next) => {
		const { session } = req, user = await session.user,
			ownerID = req.query?.userID
			// check if user has the privilege to get avatar
			// if (!user.hasPriv(TODO('access to avatar'))){
			// 	return 
			// }
		appDataWithFs
			.loadFile({ userID: ownerID, url: '/avatar' })
			.then(async fileDescriptor => {
				if (!fileDescriptor) return res.sendStatus(statusCode.ClientError.NotFound)
				// pipe file to res
				fileDescriptor.pipe(res)
				logger.access(`send file ${fileDescriptor.fileID} to <${req.origin}>`)
			})
			.catch(e => {
				logger.errAcc(`Can not get ${ownerID}'s avatar: ${e.stack}`)
				res.sendStatus(statusCode.ServerError.InternalServerError)
			})
	})
Resolved.launch(server)
