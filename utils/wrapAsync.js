import logger from '../lib/logger.js'

function errorHandler(e) {
	logger.error(`Uncaught error during async execution: ${e?.stack}`)
}
/**
 * Warp async function or promise with a fallback error handler
 * @param {import('express').Handler} fn
 * Can accept any Function or Promise 
 * @returns {Function | Promise}
 */
export default function wrap(fn) {
	if (fn instanceof Promise) {
		return fn.catch(errorHandler)
	}
	return async function wrappedAsyncFunction(...args) {
		try {
			return await fn(...args)
		} catch (e) {
			errorHandler(e)
		}
	}
}