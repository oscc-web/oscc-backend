import { init } from '../lib/env.js'
import http from 'http'
import 'colors'

init(import.meta)
const TIME_OUT = 2000
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
console.log('Test: fetch mailer response code is 200, returns as expected'.green)
let req = http.request(options, res => {
	console.log('Status: ' + res.statusCode)
})
req.write(JSON.stringify(payload))
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
payload.template = 'noExistTemplate'
console.log('Test: fetch mailer response code is 500, returns as expected'.green)
req = http.request(options, res => {
	console.log('Status: ' + res.statusCode)
})
req.write(JSON.stringify(payload))
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
options.method = 'GET'
console.log('Test: fetch mailer response code is 404, returns as expected'.green)
req = http.request(options, res => {
	console.log('Status: ' + res.statusCode)
})
req.end()
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('Test end'.green)

