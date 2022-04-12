import { setFunctionName } from 'utils/wrapAsync.js'
import logger from '../logger.js'
import Session, { SESSION_TOKEN_NAME } from '../session.js'
import conditional from './conditional.js'
/**
 * @typedef {import('express').Request} RequestWithSession
 * @param {Session} session
 * @callback HandlerWithSession
 * @param {RequestWithSession} req
 * @param {import('express').Response} res
 * @param {HandlerWithSession} next
 */
/**
 * @param {HandlerWithSession[]} servers
 */
export default function withSession(...servers) {
	return conditional(setFunctionName(async (req, res) => {
		if (req.session instanceof Session) return true
		// Find correlated session
		const session = await Session.locate(req)
		// Check if session exists
		if (!(session instanceof Session)) {
			Session.clearCookie(req, res)
			logger.debug(`Session cookie cleared for ${req.origin}`)
			return
		}
		// Check if session is still valid
		if (!session.valid) {
			await session.drop()
			Session.clearCookie(req, res)
			logger.debug(`Session cookie cleared for ${req.origin}`)
			return
		}
		// Extend session expiration time
		await session.extendExpiration(res)
		// Pass session instance down to next server(s)
		return { session }
	}, 'withSession'), ...servers)
}
