import express from 'express'
/**
 * @callback Cond
 * Checks if incoming Request should be processed by specified servers
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Object | null | undefined | Boolean | Promise} converted request arguments
 * If an object is returned, it will be assigned to the request object,
 * which would then be used as the next server's arguments.
 * Otherwise, default args (req, res, next) will be passed to next server(s)
 */
/**
 * @param {Cond | String} cond 
 * @param  {...import('express').RequestHandler} servers 
 * @returns {Promise<Any>}
 */
export default function conditional(cond, ...servers) {
	if (typeof cond === 'string')
		cond = (req) => req.url.toLowerCase().startsWith(cond.toLowerCase())
	if (typeof cond !== 'function')
		throw new TypeError(`Illegal input type for cond: ${cond}`)
	const server = servers.length ? express().use(...servers) : undefined
	return async function (req, res, next) {
		const result = await cond(req)
		// Cond does not match, pass through
		if (!result) return next()
		// Pass this request to specified servers
		Object.assign(req, typeof result === 'object' ? result : {})
		if (server)
			server.handle(req, res, next)
		else
			next()
	}
}