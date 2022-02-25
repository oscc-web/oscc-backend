import express from 'express'
export default function (hostName, ...servers) {
	if (!hostName) throw new Error('vhost hostName is missing')
	let regexp = hostName instanceof RegExp
		? hostName
		: new RegExp('^' + hostName.replace(/[^*\w]/g, '\\$&').replace(/[*]/g, '(?:.*?)') + '$', 'i')
	const server = express().use(...servers)
	return function (req, res, next) {
		// Request has no hostName specified: pass down
		if (!req.headers.host) return next()
		// Parse hostname from request header
		let hostName = req.headers.host.split(':')[0]
		// Request hostname does not match our record: pass down
		if (!regexp.test(hostName)) return next()
		// Pass this request to specified servers
		server.handle(req, res, next)
	}
}