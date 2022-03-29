// Environmental setup
import { config, PID, PROJECT_ROOT } from 'lib/env.js'
import logger from 'lib/logger.js'
import express from 'express'
import { contentDir, AppDataWithFs } from 'lib/appDataWithFs.js'
import statusCode from 'lib/status.code.js'
import withSession from 'lib/middleware/withSession.js'
import privileged from 'lib/middleware/privileged.js'
import conditional from 'lib/middleware/conditional.js'
import Resolved from 'utils/resolved.js'
import fileTransport from 'lib/middleware/fileTransport.js'
import { upload as manifest } from './manifest.js'
import { stat } from 'fs'
// temp storage path
// const storagePath = `${PROJECT_ROOT}/storage`
logger.info('Staring upload server')
const server = express()
// filter method, PUT is allowd
server.use(
	conditional(({ method }) => method === 'PUT',
	// filer user not login
		withSession(
			// filter user does not have privilege to upload
			// TODO privileged(
			// ,
			// create servers for each path in manifest
			...Object.entries(await manifest()).map(([path, { hook = (req, res, next) => next(), ...conf }]) => conditional(
				// send request to correct server according to url
				({ url }) => url.toLowerCase() == path.toLowerCase(),
				// store file in fs
				fileTransport(contentDir, conf),
				async (req, res, next) => {
					const { session, url, fileID, filePath, fileSize } = req
					// store file info into database
					await AppDataWithFs.registerFileUpload(fileID, session.userID, url, {
						fileSize,
						filePath,
						// ... (req.headers || {}),
						...{ type:req.headers?.['content-type'] },
						// fs.stat
						... await new Promise((resolve, reject) => stat(filePath, (err, stats) => {
							if (err) reject(err)
							else resolve(stats)
						}))
					},
					// store args
					conf),
					await hook(req, res, () =>
						res.status(statusCode.Success.OK).end(fileID)
					)
				} 
			)),
			function uploadErrorHandler(err, req, res, next) {
				logger.errAcc(err.stack)
				try {
					res.status(statusCode.ClientError.PayloadTooLarge).end()
					// eslint-disable-next-line no-empty
				} catch (e) {}
			}
			// ).otherwise((req, res, next) => {
			// 	res.status(statusCode.ClientError.Unauthorized).end()
			// })
		).otherwise((req, res, next) => {
			res.status(statusCode.ClientError.Unauthorized).end()
		})
	).otherwise((req, res, next) => {
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