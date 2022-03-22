// Environmental setup
import { config, PID, PROJECT_ROOT } from '../../lib/env.js'
import logger from '../../lib/logger.js'
import formidable from 'formidable'
import fs from 'fs-extra'
import express from 'express'
import { AppData } from '../../lib/appData.js'
import statusCode from '../../lib/status.code.js'
import wrap from '../../utils/wrapAsync.js'
import withSession from '../../lib/middleware/withSession.js'
import Resolved from '../../utils/resolved.js'
import conditional from '../../lib/middleware/conditional.js'
// temp storage path
const uploadDir = `${PROJECT_ROOT}/var/upload`
// const storagePath = `${PROJECT_ROOT}/storage`
logger.info('Staring upload server')
let appData = new AppData('upload')
const server = express().use(conditional(({ method }) => method === 'PUT',
	withSession(async (req, res) => {
		const { session } = req, user = await session.user
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		fs.ensureDirSync(uploadDir)
		wrap(new formidable.IncomingForm({ uploadDir }).parse(req, async (err, fields, files) => {
			if (err) {
				logger.warn('save file error:', err.stack)
				res.status(500).end('save file error')
			} else {
				if (!files.fileUpload) {
					return res.sendStatus(statusCode.ClientError.BadRequest)
				}
				await appData.store({ user, action: req.url, fileID: files.fileUpload.newFilename }, {  createTime: new Date().getTime(), origin: req.origin, size: files.fileUpload.size, acquired: false, type: files.fileUpload.mimetype })
				res.end(files.fileUpload.newFilename)
			}
		}))
	}).otherwise((req, res, next) => {
		logger.errAcc(`Session not found (requesting ${req.headers.host}${req.url} from ${req.origin})`)
		res.status(statusCode.ClientError.Unauthorized).end()
	}))
	.otherwise((req, res, next) => {
		logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
		res.status(statusCode.ClientError.MethodNotAllowed).end()
	})
)
Resolved.launch(server)
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