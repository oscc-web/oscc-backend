import http from 'http'
// Environmental setup
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import formidable from 'formidable'
import fs from 'fs-extra'
import { CronJob } from 'cron'
import express from 'express'
init(import.meta)

// temp storage path
const tempPath = `${PROJECT_ROOT}/tmp`
// const storagePath = `${PROJECT_ROOT}/storage`
// database init
import dbInit from '../../utils/mongo.js'
let db = await dbInit('upload/crud')
logger.info('Staring upload server')
let app = express()
app.use((req, res, next) => {
	if (!req?.internalCookies?.user_info) {
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.status(403).send()
	}
	next()
})
app.use('/', (req, res) => {
	let params = new URLSearchParams(req.url.split('?')[1]),
		user = JSON.parse(req.internalCookies.user_info),
		filePurpose = params.get('for')
	if (req.method === 'POST') {
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
				try {
					let records = await db.upload.find({ userID: user.id, for: filePurpose }).toArray()
					if (records.length) {
						records.forEach(file => {
							fs.removeSync(tempPath + '/' + file._id)
						})
						await db.upload.delete({ userID: user.id, for: filePurpose })
					}
					await db.upload.insert({ _id: files.fileUpLoad.newFilename, userID: user.id, createTime: new Date().getTime(), for: filePurpose, type: 'temp' })
				} catch (e) {
					return logger.warn(`Failed to insert file information into database: ${e.stack}`) && res.status(500).send()
				}
				res.send(files.fileUpLoad.newFilename)
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
					return logger.warn('Request payload is not an JSON object: ' + JSON.stringify(payload)) && res.status(400).send()
				if (payload.fileType !== 'persistent' && payload.fileType !== 'temp')
					return logger.warn('fileType is invalid: ' + JSON.stringify(payload)) && res.status(400).send()
				// update record of file in database
				db.upload
					.find({ _id: payload.fileID })
					.toArray()
					.then(result => {
						if (!result.length) {
							logger.warn(`File not found _id: ${payload.fileID}`)
							res.status(404).send()
						} else {
							db.upload
								.update({ _id: payload.fileID }, { $set: { type: payload.fileType } })
								.then(() => {
									res.status(200).send()
								})
								.catch(e => {
									logger.warn(`Failed to update file _id: ${payload.fileID}, error: ${e.stack}`)
									res.status(500).send()
								})
						}
					})
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
const expireTime = config.upload.expireTime //milliseconds
const job = new CronJob('* * * * * *', () => {
	let now = new Date().getTime()
	db.upload
		.find({ type: 'temp', createTime: { $lt: now - expireTime } })
		.toArray()
		.then(files => {
			files.forEach(file => fs.remove(`${PROJECT_ROOT}/tmp/${file._id}`))
			db.upload.delete({ type: 'temp', createTime: { $lt: now - expireTime } })
		})
		.catch(e => {
			logger.warn(`scheduled file deletion error: ${e.stack}`)
		})
}, null, true, 'Asia/Shanghai')
job.start()