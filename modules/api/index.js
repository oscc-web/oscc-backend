import express from 'express'
import http from 'http'
import path from 'path'
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
import { AppDataWithFs } from '../../lib/appData.js'
import multipart from 'connect-multiparty'
import FormData from 'form-data'
import fs from 'fs-extra'
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
let multipartMiddleware = multipart()
app.post('/user/avatar',
	multipartMiddleware,
	async (req, res, next) => {
		logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
		let user = req.internalCookies.user_info
		let fileInfo = await appDataWithFs.load({ user, action: 'avatar' })
		const { path: filePath, originalFilename } = req.files.fileUpload
		const newPath = path.join(path.dirname(filePath), originalFilename)
		fs.rename(filePath, newPath, (err) => {
			if (err) {
				return;
			} else {
				const file = fs.createReadStream(newPath)
				const form = new FormData()
				form.append('fileUpload', file)
				var request = http.request({
					method: 'POST',
					host: '127.0.0.1',
					port: config.port.upload,
					headers: form.getHeaders()
				});
				request.setHeader('cookie', req.headers.cookie)
				form.pipe(request);
				request.on('response', (response) => {
					if (response.statusCode === 200) {
						let filename = ''
						response.on('data', chunk => filename += chunk)
						response.on('end',async () => {
							if (!!fileInfo) {
								fs.removeSync(`${tempPath}/${fileInfo.name}`)
								appDataWithFs.deleteFile({ user, action: 'avatar' })
							}
							if ((await appDataWithFs.store({ filename, temp: true, createTime: new Date().getTime() }, { user, action: 'avatar' })).acknowledged) {
								await appDataWithFs.acquireFile({ user, action: 'avatar' })
							}
							res.sendStatus(200)
						})
					} else {
						res.sendStatus(response.statusCode)
					}
				});
			}
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