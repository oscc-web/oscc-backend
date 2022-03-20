import express from 'express'
import wrap from '../../utils/wrapAsync.js'
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
 * @callback ConditionalOtherwise
 * @param {...import('express').RequestHandler} servers
 * @returns {ConditionalHandler}
 */

/**
 * @typedef {import('express').RequestHandler} ConditionalHandler
 * @property {ConditionalOtherwise} otherwise
 */

/**
 * @param {Cond | String} cond 
 * @param  {import('express').RequestHandler[]} servers 
 * @returns {ConditionalHandler}
 */
export default function conditional(cond, ...servers) {
	if (typeof cond === 'string')
		cond = (req) => req.url.toLowerCase().startsWith(cond.toLowerCase())
	if (typeof cond !== 'function')
		throw new TypeError(`Illegal input type for cond: ${cond}`)
	// Condition mismatch handler, will be specified by conditional().otherwise()
	const onCondMismatch = express()
	// server(s) to use if conditions are met
	const server = servers.length ? express().use(...servers) : undefined
	// request handler
	const handle = wrap(async function (req, res, next) {
		const result = await cond(req, res)
		// Cond does not match, pass through
		if (!result)
			onCondMismatch.handle(req, res, next)
		// Apply additional parameters to Request instance
		if (result &&typeof result === 'object')
			Object.assign(req, result)
		// Pass this request to specified servers
		if (server)
			server.handle(req, res, next)
		else
			next()
	})
	/**
	 * @type {ConditionalOtherwise}
	 */
	handle.otherwise = function conditionalOtherwise(...servers) {
		onCondMismatch.use(...servers)
		return handle
	}
	// The server object to return
	/**
	 * @type {ConditionalServer}
	 */
	return handle
}