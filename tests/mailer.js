import { init } from '../lib/env.js'
import http from 'http'
import Test from './Test.js'
import { resolve } from 'path'

init(import.meta)
let options = {
	hostname: '127.0.0.1',
	port: 9998,
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
	}
}
let payload = {
	template: 'validateEmail',
	to: 'wxl994119862@stu.zzu.edu.cn',
	args: {
		link: 'ysyx.org/register?token=token123456'
	}
}
new Test('fetch mailer with correct option and payload')
	.run(async () => {
		return await new Promise(resolve => {
			let req = http.request(options, res => {
				resolve(res.statusCode)
			})
			req.write(JSON.stringify(payload))
			req.end()
		})
	}).expect(200)

new Test('fetch mailer with GET method and payload')
	.run(async () => {
		return await new Promise(resolve => {
			options.method = 'GET'
			let req = http.request(options, res => {
				resolve(res.statusCode)
			})
			req.write(JSON.stringify(payload))
			req.end()
		})
	}).expect(404)

new Test('fetch mailer with nonexistent template and payload')
	.run(async () => {
		return await new Promise(resolve => {
			options.method = 'POST'
			payload.template = 'noExistTemplate'
			let req = http.request(options, res => {
				resolve(res.statusCode)
			})
			req.write(JSON.stringify(payload))
			req.end()
		})
	}).expect(500)

