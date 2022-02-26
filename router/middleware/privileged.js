import { logger } from '../../lib/env.js'
import { PRIV, PRIV_LUT } from '../../lib/privileges.js'
import User from '../../lib/user.js'
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
export default function (
	priv,
	{
		activeCond = () => true,
		denyAction = (req, res) => res.writeHead(403).end(),
		reduceCond = (a, b) => a || b,
	}
) {
	let privileges
	if (!Array.isArray(priv)) {
		if (priv in PRIV)
			privileges = [PRIV[priv]]
		else if (priv in PRIV_LUT)
			privileges = [priv]
		else
			throw new TypeError
	} else {
		// Deep clone from priv to privileges
		privileges = Object.assign([], privileges)
	}
	// Return the handler
	return async (req, res, next) => {
		// Only apply the limit on given conditions
		if (!activeCond(req)) return next()
		// Condition matched, locate user
		logger.verbose(`Middleware "Privileged" captured incoming request with parsedCookies ${JSON.stringify(req?.parsedCookies)}`)
		const user = await User.locate(req?.internalCookies?.userID)
		logger.verbose(`Extracted ${user} from internalCookies ${JSON.stringify(req?.internalCookies)}`)
		if(user instanceof User) {
			// Check privileges
			const isPrivileged = privileges
				.map(priv => user.hasPriv(priv))
				.reduce(reduceCond)
			// Act according to result
			if (isPrivileged) return next()
		}
		logger.errAcc(`${user || 'GuestUser'} (from ${req.origin}) does not have privilege to access ${req.hostname}${req.url}`)
		return denyAction(req, res, next)
	}
}