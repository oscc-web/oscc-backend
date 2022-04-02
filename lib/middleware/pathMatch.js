import { setFunctionName } from 'utils/wrapAsync.js'
import conditional from './conditional.js'
/**
 * Mixed function with method options
 */
const pathMatch = Object.assign(
	/**
	 * Match and strip request path according to given path segment
	 * @param {String | RegExp} path
	 * The path element that matches the start of path.
	 * @param  {import('express').RequestHandler[]} servers
	 */
	function pathMatch(path, ...servers) {
		const [condition, name] = (() => {
			if (path instanceof RegExp) return [
				({ path }) => new RegExp(path).test(path)
					? path.replace(new RegExp(path), '').replace(/^\/?/, '/')
					: undefined,
				'Regex'
			]
			if (path) switch (typeof path) {
				case 'function':
					return [path, 'CustomFunction']
				case 'string':
					return [
						req => req.path.toLowerCase().startsWith(path.toLowerCase())
							? req.path.slice(path.length).replace(/^\/?/, '/')
							: undefined,
						'String'
					]
			}
			throw new TypeError
		})()
		// Return the function with mixed options
		return Object.assign(conditional(
			setFunctionName(req => {
				const testResult = condition(req)
				return testResult
					? { pathMatch: { path: testResult } }
					: undefined
			}, `pathMatch${name}[${path}]`),
			...servers
		), {
			get stripped() {
				return conditional(
					setFunctionName(req => {
						const testResult = condition(req)
						return testResult
							? {
								url: [
									testResult,
									...req.url.split('?').splice(1)
								].join('?')
							}
							: undefined
					}, `pathMatch${name}(stripped)[${path}]`),
					...servers
				)
			}
		})
	},
	...['GET', 'POST', 'PUT', 'DELETE'].map(m => ({
		get [m]() {
			return (path, ...servers) => pathMatch(
				path,
				conditional(({ method }) => method.toUpperCase() === m, ...servers)
			)
		}
	}))
)
// Export the function with method options
export default pathMatch
