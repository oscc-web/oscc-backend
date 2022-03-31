import { setFunctionName } from 'utils/wrapAsync.js'
import conditional from './conditional.js'
/**
 * Match and strip request path according to given path segment
 * @param {String | RegExp} path
 * The path element that matches the start of path.
 * @param  {import('express').RequestHandler[]} servers
 */
export default function pathMatch(path, ...servers) {
	if (path && typeof path === 'string') return conditional(
		setFunctionName(req => {
			if (req.path.toLowerCase().startsWith(path.toLowerCase())) return {
				pathMatch: { url: req.path.slice(path.length) }
			}
			else return undefined
		}, `pathMatchString[${path}]`),
		...servers
	)
	else if (path instanceof RegExp) return conditional(
		setFunctionName(req => {
			return new RegExp(path).test(req.path)
				? { pathMatch: { url: req.path.replace(path, '') } }
				: undefined
		}, `pathMatchRegex[${path}]`),
		...servers
	)
	else throw new TypeError
}
