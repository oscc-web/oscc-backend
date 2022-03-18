import express, { response } from 'express'
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import { AppDataWithFs } from '../../lib/appData.js'
import bodyParser from 'body-parser'
import statusCode from '../../lib/status.code.js'
init(import.meta)
logger.info('Staring api server')
let app = express()
let appDataWithFs = new AppDataWithFs()
const tempPath = `${PROJECT_ROOT}/tmp`
app.use('/user', (req, res, next) => {
	if (!req?.internalCookies?.user_info) {
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.status(403).send()
	}
	next()
})
app.post('/user/avatar',
	bodyParser.json(),
	async (req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		let user = JSON.parse(req.internalCookies.user_info)
		console.log(typeof req.body.fileID)
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
		let user = req.internalCookies.user_info
		let fileInfo = await appDataWithFs.load({ user, action: 'avatar' })
		if (!fileInfo || fileInfo.temp) return res.sendStatus(404)
		res.sendFile(`${tempPath}/${fileInfo.filename}`)
	}
)
app.listen(config.port.api, () => {
	logger.info(`api server up and running at port ${config.port.api}`)
})