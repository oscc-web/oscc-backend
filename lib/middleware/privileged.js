import { setFunctionName } from 'utils/wrapAsync.js'
import logger from '../logger.js'
import { PRIV, PRIV_LUT } from '../privileges.js'
import Session from '../session.js'
import statusCode from '../status.code.js'
import User from '../user.js'
import conditional from './conditional.js'
import withSession from './withSession.js'
/**
 * Only let users with appropriate privileges pass through.
 * NOTICE: This middleware is intended to be used after Session.preprocessor 
 * @param {(PRIV | PRIV_LUT)[]} priv 
 * @param {{
 * activeCond: (req: import('express').Request) => Boolean,
 * denyAction: import('express').Handler,
 * reduceCond: (a: Boolean, b: Boolean) => Boolean
 * }} args
 */
export default function privileged(
	priv,
	...servers
) {
	let reduceCond = (a, b) => a || b,
		denyAction = (req, res) => res.status(statusCode.ClientError.Unauthorized) && false
	/**
	 * @type {...PRIV[]}
	 */
	const privileges = Object.freeze((() => {
		if (!Array.isArray(priv)) {
			if (priv in PRIV)
				return [PRIV[priv]]
			else if (priv in PRIV_LUT)
				return [priv]
			else
				throw new TypeError
		} else {
			// Deep clone from priv to privileges
			return priv = priv.map(p => (p in PRIV ? PRIV[p] : p))
		} })())
	// Return the handler
	const handle = Object.assign(withSession(
		// Do the check
		conditional(setFunctionName(async (req, res) => {
			logger.verbose(`Middleware "Privileged" captured incoming request by ${await req.session.user}`)
			const user = await req.session.user
			// Check privileges
			const isPrivileged = (await Promise.all(
				privileges.map(priv => user.hasPriv(priv))
			)).reduce(reduceCond, false)
			if (!isPrivileged) {
				logger.errAcc(`${user} from ${req.origin} does not have privilege to access ${req.hostname}${req.url}`)
				return await denyAction(req, res)
			}
			return true
		}, `privileged[${privileges.map(p => PRIV_LUT[p]).join(', ')}]`), ...servers)
	), {
		reduceCond(fn) {
			reduceCond = setFunctionName(fn, fn.name || 'customReduceCond')
			return handle
		},
		denyAction(fn) {
			denyAction = setFunctionName(fn, fn.name || 'customDenyAction')
			return handle
		},
	})
	return handle
}
