import http from 'http'
import Test from './Test.js'
import { resolve } from 'path'
const options = {
	hostname: '127.0.0.1',
	port: 9998,
	method: 'POST',
	headers: { 'Content-Type': 'application/json', }
}
const payload = {
	template: 'validateEmail',
	to: 'wxl994119862@stu.zzu.edu.cn',
	args: { link: 'ysyx.org/register?token=token123456' }
}
new Test('fetch mailer with correct option and payload')
	.run(async () => {
		return await new Promise(resolve => {
			const req = http.request(options, res => {
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
			const req = http.request(options, res => {
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
			const req = http.request(options, res => {
				resolve(res.statusCode)
			})
			req.write(JSON.stringify(payload))
			req.end()
		})
	}).expect(500)

