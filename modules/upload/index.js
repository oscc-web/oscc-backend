// Environmental setup
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import formidable from 'formidable'
import fs from 'fs-extra'
import express from 'express'
import { AppData } from '../../lib/appData.js'
import statusCode from '../../lib/status.code.js'
// temp storage path
const tempPath = `${PROJECT_ROOT}/tmp`
// const storagePath = `${PROJECT_ROOT}/storage`
init(import.meta)
logger.info('Staring upload server')
let appData = new AppData('upload')
let app = express()
app.use((req, res, next) => {
	if (!req?.internalCookies?.user_info) {
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.status(403).send()
	}
	next()
})
app.use((req, res) => {
	let user = JSON.parse(req.internalCookies.user_info)
	if (req.method === 'PUT') {
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
				if (!files.fileUpload) {
					return res.sendStatus(statusCode.ClientError.BadRequest)
				}
				await appData.store({ user, action: req.url, fileID: files.fileUpload.newFilename }, {  createTime: new Date().getTime(), origin: req.origin, size: files.fileUpload.size, acquired: false })
				res.send(files.fileUpload.newFilename)
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