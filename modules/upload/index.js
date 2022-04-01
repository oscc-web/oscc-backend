// Environmental setup
import logger from 'lib/logger.js'
import express from 'express'
import { contentDir, AppDataWithFs } from 'lib/appDataWithFs.js'
import fileTransport from 'lib/middleware/fileTransport.js'
import withSession from 'lib/middleware/withSession.js'
import privileged from 'lib/middleware/privileged.js'
import conditional from 'lib/middleware/conditional.js'
import pathMatch from 'lib/middleware/pathMatch.js'
import statusCode from 'lib/status.code.js'
import { CustomError } from 'lib/errors.js'
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
import { upload as manifest } from './manifest.js'
import { stat } from 'fs'
// Temp storage path
// const storagePath = `${PROJECT_ROOT}/storage`
logger.info('Staring upload server')
const server = express()
// Filter method, PUT is allowed
	.use(
		conditional(({ method }) => method === 'PUT',
			// Filer user not login
			withSession(
			// Filter user does not have privilege to upload
			// TODO privileged(
			// ,
			// create servers for each path in manifest
				...Object.entries(await manifest()).map(([
					path,
					{
						hook = (req, res, next) => next(),
						// AppDataWithFs storage configurations
						duplicate = false,
						replace = false,
						// FileTransport configurations
						contentType,
						maxSize,
						checkID,
						// Privilege control configurations
						privileges = [],
						// Additional configurations
						...conf
					}
				]) => pathMatch(
				// Send request to correct server according to url
					path,
					privileged(privileges,
					// Transport request body into local file system
						fileTransport(contentDir, { contentType, maxSize, checkID, ...conf }),
						wrap(async (req, res, next) => {
							const { session, url, fileID, filePath, fileSize } = req
							// Store file info into database
							await AppDataWithFs.registerFileUpload(
								fileID,
								session.userID,
								url,
								{
									fileSize,
									filePath,
									// ... (req.headers || {}),
									...{ type: req.headers?.['content-type'] },
									// Fs.stat
									...await new Promise((resolve, reject) => stat(filePath, (err, stats) => {
										if (err) reject(err)
										else resolve(stats)
									}))
								},
								// Store args
								{ duplicate, replace, ...conf }
							),
							await hook(req, res, () =>
								res.status(statusCode.Success.Created).end(fileID)
							)
						})
					)
				))
			).otherwise((req, res, next) => {
				res.status(statusCode.ClientError.Unauthorized).end()
			})
		).otherwise((req, res, next) => {
			logger.errAcc(`${req.method} not allowed (requesting ${req.headers.host}${req.url} from ${req.origin})`)
			res.status(statusCode.ClientError.MethodNotAllowed).end()
		})
	)
	.use(CustomError.handler)
Resolved.launch(server)
// Scheduled deletion
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
