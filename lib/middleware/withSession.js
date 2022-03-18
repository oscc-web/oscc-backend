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
	return conditional(async (req, res) => {
		if (req.session instanceof Session) return {}
		// Find correlated session
		const session = await Session.locate(req)
		// Check if session exists
		if (!(session instanceof Session)) {
			return
		}
		// Check if session is still valid
		if (!session.valid) {
			session.drop()
			res.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
			return
		}
		// Pass session instance down to next server(s)
		return { session }
	}, ...servers)
}