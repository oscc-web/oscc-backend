import { init, config, PROJECT_ROOT } from 'lib/env.js'
import dbInit from 'utils/mongo.js'
import 'colors'
import fs from 'fs-extra'
import http from 'http'
import FormData from 'form-data'
init(import.meta)
let db = await dbInit('upload/crud')
const TIME_OUT = 2000
let options = {
	'method': 'GET',
	'hostname': '127.0.0.1',
	'port': 9997,
	'path': '/?for=resume'
}
const readStream = fs.createReadStream(`${PROJECT_ROOT}/README.md`)
let form = new FormData()
form.append('fileUpLoad', readStream)
console.log('Test: fetch upload response code is 403, returns as expected'.green)
let req = http.request(options, res =>
	console.log(res.statusCode.toString().blue)
)
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
options.headers = { 'Cookie': '__internal_user_info={"id":123,"name":"wxl"}', }
console.log('Test: fetch upload response code is 405, returns as expected'.green)
req = http.request(options, res =>
	console.log(res.statusCode.toString().blue)
)
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: fetch upload response code is 200, returns as expected'.green)
options.method = 'POST'
options.headers = form.getHeaders()
options.headers.Cookie = '__internal_user_info={"id":123,"name":"wxl"}'
let rawData = ''
req = http.request(options, res => {
	console.log(res.statusCode.toString().blue)
	res.on('data', (chunk) => { rawData += chunk })
	res.on('end', async () => {
		try {
			// const parsedData = JSON.parse(rawData);
			console.log('Test: find file in db'.green)
			console.log(JSON.stringify((await db.upload.find({ _id: rawData }).toArray())[0]).blue)
			console.log('Test: find file in fs'.green)
			console.log(fs.existsSync(`${PROJECT_ROOT}/tmp/${rawData}`))
		} catch (e) {
			console.error(e.message)
		}
	})
})
form.pipe(req)
await new Promise(res => setTimeout(() => res(), config.upload.expireTime))
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: can not find file in db after expire time'.green)
console.log(JSON.stringify((await db.upload.find({ _id: rawData }).toArray())[0]))
console.log('Test: can not find file in fs after expire time'.green)
console.log(fs.existsSync(`${PROJECT_ROOT}/tmp/${rawData}`))

await new Promise(res => setTimeout(() => res(), TIME_OUT))
form = new FormData()
form.append('fileUpLoad', fs.createReadStream(`${PROJECT_ROOT}/README.md`))
options.headers = form.getHeaders()
options.headers.Cookie = '__internal_user_info={"id":123,"name":"wxl"}'
let str = ''
let req2 = http.request(options, res => {
	res.on('data', (chunk) => { str += chunk })
})
form.pipe(req2)

options.method = 'PUT'
options.headers = {
	'Content-Type': 'application/json',
	'Cookie': '__internal_user_info={"id":123,"name":"wxl"}'
}
console.log('Test: fetch upload response code is 404, returns as expected'.green)
req = http.request(options, res => {
	console.log(res.statusCode.toString().blue)
})
req.write(JSON.stringify({
	'fileID': 'str',
	'fileType': 'persistent'
}))
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: fetch upload response code is 200, returns as expected'.green)
await new Promise(res => setTimeout(() => res(), TIME_OUT))
req = http.request(options, res => {
	console.log(res.statusCode.toString().blue)
	// res.on('data', (chunk) => { rawData += chunk; });
})
req.write(JSON.stringify({
	'fileID': str,
	'fileType': 'persistent'
}))
req.end()
await new Promise(res => setTimeout(() => res(), config.upload.expireTime))
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: can find file in db after expire time'.green)
console.log(JSON.stringify((await db.upload.find({ _id: str }).toArray())[0]).blue)
console.log('Test: can find file in fs after expire time'.green)
console.log(fs.existsSync(`${PROJECT_ROOT}/tmp/${str}`))

await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: fetch upload response code is 400, returns as expected'.green)
req = http.request(options, res => {
	console.log(res.statusCode.toString().blue)
})
req.write(JSON.stringify({
	'fileID': str,
	'fileType': 'fileType'
}))
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: fetch upload response code is 200, returns as expected'.green)
await new Promise(res => setTimeout(() => res(), TIME_OUT))
req = http.request(options, res => {
	console.log(res.statusCode.toString().blue)
})
req.write(JSON.stringify({
	'fileID': str,
	'fileType': 'temp'
}))
req.end()

await new Promise(res => setTimeout(() => res(), config.upload.expireTime))
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test: can not find file in db after expire time'.green)
console.log(JSON.stringify((await db.upload.find({ _id: str }).toArray())[0]))
console.log('Test: can not find file in fs after expire time'.green)
console.log(fs.existsSync(`${PROJECT_ROOT}/tmp/${str}`))
console.log('Test end'.green)
process.exit(0)
