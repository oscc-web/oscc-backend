// Environmental setup
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import formidable from 'formidable'
import fs from 'fs-extra'
import express from 'express'
import { AppData } from '../../lib/appData.js'
import statusCode from '../../lib/status.code.js'
init(import.meta)

// temp storage path
const tempPath = `${PROJECT_ROOT}/tmp`
// const storagePath = `${PROJECT_ROOT}/storage`
// database init
import dbInit from '../../utils/mongo.js'
let db = await dbInit('upload/crud')
logger.info('Staring upload server')
let appData = new AppData()
let app = express()
app.use((req, res, next) => {
	if (!req?.internalCookies?.user_info) {
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.status(403).send()
	}
	next()
})
app.use('/', (req, res) => {
	let user = JSON.parse(req.internalCookies.user_info)
	if (req.method === 'POST') {
		let params = new URLSearchParams(req.url.split('?')[1]),
			filePurpose = params.get('for')
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		fs.ensureDirSync(tempPath)
		let
			options = {
				uploadDir: tempPath
			},
			form = new formidable.IncomingForm(options)
		form.parse(req, async (err, fields, files) => {
			if (err) {
				logger.warn('save file error:', err.stack)
				res.status(500).send('save file error')
			} else {
				await appData.store({ fileID: files.fileUpload.newFilename, createTime: new Date().getTime(), origin: req.origin, size: files.fileUpload.size, acquired: false }, { user, action: filePurpose })
				res.send(files.fileUpload.newFilename)
			}
		})
	} else if (req.method === 'PUT') {
		const body = []
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		req
			.on('data', chunk => body.push(chunk))
			.on('end', () => {
				const payload = JSON.parse(body.join(''))
				if (!payload || typeof payload !== 'object')
					// Payload is not a valid JSON object
					return logger.errAcc('Request payload is not an JSON object: ' + JSON.stringify(payload)) && res.sendStatus(statusCode.ClientError.BadRequest)
				let content = await appData.load({ user, action: payload.action })
				if (!!payload.fileID && content.fileID !== payload.fileID) {
					logger.errAcc(`File ${payload.fileID} of User ${user} not found`)
					return res.sendStatus(statusCode.ClientError.NotFound)
				} else {
					appData
						.update({ acquired: true }, { user, action: payload.action })
						.then(result => logger.access(`File ${payload.fileID} acquired`) && res.sendStatus(statusCode.Success.OK))
						.catch(e => {
							logger.errAcc(`File ${payload.fileID} acquire error: ${e}`)
							res.sendStatus(statusCode.ServerError.InternalServerError)
						})
				}
			})
	} else {
		logger.warn(`Rejected ${req.method} request from ${req.origin}`)
		res.status(405).send()
	}
})
app.listen(config.port.upload, () => {
	logger.info(`Upload server up and running at port ${config.port.upload}`)
})
// scheduled deletion
// const expireTime = config.upload.expireTime //milliseconds
// const job = new CronJob(config.upload.cron, () => {
// 	let now = new Date().getTime()
// 	db.upload
// 		.find({ type: 'temp', createTime: { $lt: now - expireTime } })
// 		.toArray()
// 		.then(files => {
// 			files.forEach(file => fs.remove(`${PROJECT_ROOT}/tmp/${file._id}`))
// 			db.upload.delete({ type: 'temp', createTime: { $lt: now - expireTime } })
// 		})
// 		.catch(e => {
// 			logger.warn(`scheduled file deletion error: ${e.stack}`)
// 		})
// }, null, true, 'Asia/Shanghai')
// job.start()