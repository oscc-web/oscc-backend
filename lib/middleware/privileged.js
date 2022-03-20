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
 * @returns {import('express').Handler}
 */
export default function privileged(
	priv,
	{
		reduceCond = (a, b) => a || b,
		denyAction = (req, res) => res.status(statusCode.ClientError.Unauthorized) && false
	},
	...servers
) {
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
			return Object.assign([], priv)
		}})())
	// Return the handler
	return withSession(
		// Do the check
		conditional(async (req, res) => {
			logger.verbose(`Middleware "Privileged" captured incoming request by ${await req.session.user}`)
			const user = await req.session.user
			// Check privileges
			const isPrivileged = await Promise.all(
				privileges.map(priv => user.hasPriv(priv))
			).reduce(reduceCond, false)
			if (!isPrivileged) {
				logger.errAcc(`${user} from ${req.origin} does not have privilege to access ${req.hostname}${req.url}`)
				return await denyAction(req, res)
			}
			return true
		}, ...servers)
	)
}