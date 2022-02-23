import http from 'http'
// Environmental setup
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import formidable from 'formidable'
import fs from 'fs-extra'
import { CronJob } from 'cron'
init(import.meta)

// temp storage path
const tempPath = `${PROJECT_ROOT}/tmp`
// const storagePath = `${PROJECT_ROOT}/storage`
// database init
import dbInit from '../../lib/mongo.js'
let db = await dbInit('fileSystem/crud')
logger.info('Staring fileSystem server')
http.createServer((req, res) => {
	// reject user not logged in
	if (!req?.internalCookie?.user_info) {
		console.log(req?.internalCookie)
		return logger.warn(`Rejected user not logged in from ${req?.origin}`) && res.writeHead(403).end()
	}
	let params = new URLSearchParams(req.url.split('?')[1]),
		user = JSON.parse(req.internalCookie.user_info),
		filePurpose = params.get('for')
	if (req.method === 'POST') {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		fs.ensureDirSync(tempPath)
		let
			options = {
				uploadDir: tempPath
			},
			form = new formidable.IncomingForm(options)
		form.parse(req, async function (err, fields, files) {
			if (err) {
				logger.warn('save file error:', err.stack)
				res.writeHead(500).end('save file error')
			} else {
				try {
					let records = await db.fileSystem.find({ userID: user.id, for: filePurpose }).toArray()
					if (records.length) {
						records.forEach(file => {
							fs.removeSync(tempPath + '/' + file._id)
						})
						await db.fileSystem.delete({ userID: user.id, for: filePurpose })
					}
					await db.fileSystem.insert({ _id: files.fileUpLoad.newFilename, userID: user.id, createTime: new Date().getTime(), for: filePurpose, type: 'temp' })
				} catch (e) {
					return logger.warn(`Failed to insert file information into database: ${e.stack}`) && res.writeHead(500).end()
				}
				res.end(files.fileUpLoad.newFilename)
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
					return logger.warn('Request payload is not an JSON object: ' + JSON.stringify(payload)) && res.writeHead(400).end()
				if (payload.fileType !== 'persistent' && payload.fileType !== 'temp')
					return logger.warn('fileType is invalid: ' + JSON.stringify(payload)) && res.writeHead(400).end()
				// update record of file in database
				db.fileSystem
					.find({ _id: payload.fileID })
					.toArray()
					.then(result => {
						if (!result.length) {
							logger.warn(`File not found _id: ${payload.fileID}`)
							res.writeHead(404).end()
						} else {
							db.fileSystem
								.update({ _id: payload.fileID }, { $set: { type: payload.fileType } })
								.then(() => {
									res.writeHead(200).end()
								})
								.catch(e => {
									logger.warn(`Failed to update file _id: ${payload.fileID}, error: ${e.stack}`)
									res.write(500).end()
								})
						}
					})
			})
	} else {
		logger.warn(`Rejected ${req.method} request from ${req.origin}`)
		res.writeHead(405).end()
	}
}).listen(config.port.fileSystem, () => {
	logger.info(`FileSystem up and running at port ${config.port.fileSystem}`)
})
// scheduled deletion
const expireTime = config.fileSystem.expireTime //milliseconds
const job = new CronJob('* * * * * *', () => {
	let now = new Date().getTime()
	db.fileSystem
		.find({ type: 'temp', createTime: { $lt: now - expireTime } })
		.toArray()
		.then(files => {
			files.forEach(file => fs.remove(`${PROJECT_ROOT}/tmp/${file._id}`))
			db.fileSystem.delete({ type: 'temp', createTime: { $lt: now - expireTime } })
		})
		.catch(e => {
			logger.warn(`scheduled file deletion error: ${e.stack}`)
		})
}, null, true, 'Asia/Shanghai')
job.start()