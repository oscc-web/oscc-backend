export default function (hostName, server) {
	if (!hostName) throw new Error('vhost hostName is missing')
	if (!server) throw new Error('vhost server is missing')
	let regexp = hostName instanceof RegExp
		? hostName
		: new RegExp('^' + hostName.replace(/[^*\w]/g, '\\$&').replace(/[*]/g, '(?:.*?)') + '$', 'i')
	if (server.onvhost) server.onvhost(hostName)
	return function (req, res, next) {
		// Request has no hostName specified: pass down
		if (!req.headers.host) return next()
		// Parse hostname from request header
		let hostName = req.headers.host.split(':')[0]
		// Request hostname does not match our record: pass down
		if (!regexp.test(hostName)) return next()
		// Pass this request to specified server
		if (server instanceof Function) return server(req, res, next)
		server.emit('request', req, res)
	}
}