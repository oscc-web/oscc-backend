import http from 'http'
import { extractIdentityFromURL } from 'lib/env.js'
import statusCode from 'lib/status.code.js'
import Resolved from 'utils/resolved.js'
// Create a pending service resolution
const resolver = new Resolved(extractIdentityFromURL(import.meta.url), false).resolver
/**
 * @typedef {('validateMail' | 'XXX')} mailTemplate
 */

/**
 * Send email to specified address using certain template
 * @param {String} address 
 * @param {mailTemplate} template 
 * @param {Object} args 
 */
export async function sendMail(address, template, args) {
	const target = await resolver()
	return new Promise((resolve, reject) => {
		http
			.request({
				hostname: '127.0.0.1',
				...target,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			}, res => {
				if (res.statusCode === statusCode.Success.OK)
					resolve()
				else {
					let message = ''
					res.on('data', chunk => message += chunk)
					res.on('end', () => reject(new Error(message)))
				}
			})
			.on('error', reject)
			.end(JSON.stringify({
				to: address,
				template,
				args
			}))
	})
}
