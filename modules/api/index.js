import express, { response } from 'express'
import { config, PROJECT_ROOT } from '../../lib/env.js'
import { AppDataWithFs } from '../../lib/appDataWithFs.js'
import bodyParser from 'body-parser'
import statusCode from '../../lib/status.code.js'
import logger from '../../lib/logger.js'
import errorHandler from '../../utils/errorHandler.js'
import withSession from '../../lib/middleware/withSession.js'
logger.info('Staring api server')
let app = express()
let appDataWithFs = new AppDataWithFs()
const tempPath = `${PROJECT_ROOT}/tmp`
app.use('/user', (req, res, next) => {
	if (!req?.internalCookies?.user_info) {
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.status(403).send()
	}
	next()
}).use(withSession())
app.post('/user/avatar',
	bodyParser.json(),
	async (req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		let user = req.session.user
		appDataWithFs
			.acquireFile({ user, action: '/avatar', fileID: req.body.fileID })
			.then(result => {
				res.status(statusCode.Success.OK).end(JSON.stringify(result))
			}).catch(e => {
				logger.errAcc(`File accquired error: ${e.stack}`)
				res.sendStatus(statusCode.ServerError.InternalServerError)
			})
	})
app.get('/user/avatar',
	async (req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		let user = req.session.user,
			fileID = req.query?.fileID
		appDataWithFs
			.loadFile({ user, action: '/avatar', fileID })
			.then(fileDescriptor => {
				if (!fileDescriptor) return res.sendStatus(statusCode.ClientError.NotFound)
				fileDescriptor.pipe(res)
			})
			.catch(e => {
				logger.errAcc(`Can not get ${user}'s file ${fileID}: ${e.stack}`)
				res.sendStatus(statusCode.ServerError.InternalServerError)
			})
	}
)
app.listen(config.port.api, () => {
	logger.info(`api server up and running at port ${config.port.api}`)
})