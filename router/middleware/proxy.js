import http from 'http'
// import httpProxy from 'http-proxy'
/**
 * Proxies all http and webSocket traffic to target generated by rewrite
 * @param {(req: import('express').Request) => {
 * 	hostname: String,
 * 	port: Number,
 * 	path: String,
 * 	method: String,
 * 	headers: Object
 * }} rewrite 
 * @returns {(
 *	req: import('express').Request,
 *	res: import('express').Response,
 *	next: NextFunction
 * ) => undefined}
 */
export default function (rewrite) {
	// Check if rewrite is a function
	if (typeof rewrite !== 'function') throw new TypeError()
	// Return express server
	return function (req, res) {
		// Apply custom request transform
		const proxy = http.request(rewrite(req), next_res => {
			res.writeHead(next_res.statusCode, next_res.headers)
			next_res.pipe(res, {
				end: true
			})
		})
		req.pipe(proxy, { end: true })
	}
}