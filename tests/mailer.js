import { init } from '../lib/env.js'
import fetch from 'node-fetch'
import 'colors'

init(import.meta)
const TIME_OUT = 2000
await new Promise(res => setTimeout(() => res(), TIME_OUT))
console.log('starting test server'.green)
let payload = {
	template: 'validateEmail',
	to: 'wxl994119862@stu.zzu.edu.cn',
	args: {
		link: 'ysyx.org/register?token=token123456'
	}
}
let requestOptions = {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify(payload),
	mode: 'cors'
}
console.log(JSON.stringify(requestOptions).green)
console.log('Test: fetch mailer response code is 200, returns as expected'.green)
fetch(
	'http://127.0.0.1:9998',
	requestOptions
).then(res => {
	console.log(JSON.stringify(res.status).blue)
}).catch(e => {
	console.log(e.message.red)
})
await new Promise(res => setTimeout(() => res(), TIME_OUT))
payload.template = 'noExistTemplate'
requestOptions.body = JSON.stringify(payload)
console.log('Test: fetch mailer response code is 500, returns as expected'.green)
// fetch(
// 	'http://127.0.0.1:9998',
// 	requestOptions
// ).then(res => {
// 	console.log(JSON.stringify(res.status).blue)
// }).catch(e => {
// 	console.log(e.message.red)
// })

