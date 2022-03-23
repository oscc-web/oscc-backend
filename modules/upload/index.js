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
import getRawBody from 'raw-body'
import { v4 as uuid } from 'uuid'
// temp storage path
const uploadDir = `${PROJECT_ROOT}/var/upload`
// const storagePath = `${PROJECT_ROOT}/storage`
logger.info('Staring upload server')
let appData = new AppData('upload')
const server = express()
// filter method, PUT is allowd
server.use(conditional(({ method }) => method === 'PUT',
	// filer user not login
	withSession(async (req, res) => {
		const { session } = req, user = await session.user
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		// ensure uploadDir exists
		fs.ensureDirSync(uploadDir)
		// get req.body
		getRawBody(req, {
			// length: req.headers['content-length'],
			/**
     		* The expected length of the stream.
     		*/
			length: '500kb'
		}).then(async buffer => {
			let fileID = uuid()
			// write file
			fs.createWriteStream(`${uploadDir}/${fileID}`).write(buffer)
			// store upload appData
			await appData.store({ user: JSON.stringify(user), action: '/avatar', fileID }, { acquired:false, cTime: new Date(), mTime: new Date(), aTime: new Date(), type: req.headers['content-type'], size: buffer.length })
			logger.access(`receive file ${fileID} from ${req.origin}`)
			res.status(statusCode.Success.OK).end(fileID)
		}).catch(e => {
			logger.errAcc(`save file from <${req.origin}> error :${e.stack}`)
			res.status(statusCode.ServerError.InternalServerError).end()
		})
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