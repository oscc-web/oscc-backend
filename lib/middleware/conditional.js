import express from 'express'
import wrap, { setFunctionName } from '../../utils/wrapAsync.js'
import logger from '../logger.js'
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
	if (typeof cond === 'string') {
		cond = setFunctionName(
			(req) => req.url.toLowerCase().startsWith(cond.toLowerCase()),
			`inlineUrlStartsWith:${cond}`
		)
	}
	if (typeof cond !== 'function')
		throw new TypeError(`Illegal input type for cond: ${cond}`)
	// Condition mismatch handler, will be specified by conditional().otherwise()
	const onCondMismatch = express().use((req, res, next) => next())
	// server(s) to use if conditions are met
	const server = servers.length ? express().use(...servers) : undefined
	// request handler
	const handle = Object.assign(wrap(async function (req, res, next) {
		const result = await cond(req, res)
		logger.debug(`Conditional match result ${cond.name} => ${JSON.stringify(result)}`)
		// Cond does not match, pass through
		if (!result)
			return onCondMismatch.handle(req, res, next)
		// Apply additional parameters to Request instance
		if (result &&typeof result === 'object')
			Object.assign(req, result)
		// Pass this request to specified servers
		if (server)
			server.handle(req, res, next)
		else
			next()
	}, `conditional[${cond.name}]`), {
		otherwise: (...servers) => {
			onCondMismatch.use(...servers)
			return handle
		} 
	})
	// The server object to return
	/**
	 * @type {ConditionalServer}
	 */
	return handle
}