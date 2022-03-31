import { CustomError } from 'lib/errors.js'
import logger from 'lib/logger.js'
/**
 * Warp async function or promise with a fallback error handler
 * @param {import('express').Handler} fn
 * @param {String} name
 * Name of the wrapped function, defaults to the input function name
 * Can accept any Function or Promise
 * @returns {Function | Promise}
 */
export default function wrap(fn, name = fn?.name) {
	let { handler } = CustomError
	if (fn instanceof Promise) {
		return fn.catch(handler)
	}
	return setFunctionName(
		Object.assign(
			async function(...args) {
				try {
					return await fn(...args)
				} catch (e) {
					handler(e, ...args)
				}
			}, {
				use(customErrorHandler) {
					if (typeof customErrorHandler === 'function') handler = customErrorHandler
					else throw new TypeError
				}
			})
		,
		name
	)
}
/**
 * Set name of a function to given name
 * @param {Function} fn
 * @param {String} name
 * @returns
 */
export function setFunctionName(fn, name = fn?.name) {
	Object.defineProperty(fn, 'name', { value: name })
	return fn
}
