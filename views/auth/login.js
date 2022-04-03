import { BadRequestError, ChallengeFailedError, EntryNotFoundError } from 'lib/errors.js'
import Session from 'lib/session.js'
import statusCode from 'lib/status.code.js'
import User from 'lib/user.js'
export default async function userLoginHandler(req) {
	const { body, session } = req
	if (session instanceof Session) return sendUserInfo(await session.user)
	if (!body || typeof body !== 'object') throw new BadRequestError(
		'json payload', body, req
	)
	// Extract payload from parsed request
	const {
		login,
		password,
		persistent = false
	} = body
	// Try locate the user
	const user = await User.locate(login)
	if (!(user instanceof User)) throw new EntryNotFoundError(
		`User <${login}>`, req
	)
	// Challenge password
	if (await user.login(password)) {
		const session = new Session(
			user,
			{
				persistent,
				initiator: req.headers?.['user-agent'],
				origin: req.origin
			}
		)
		return res => session.writeToken(res).then(() => sendUserInfo(user)(res))
	} else {
		throw new ChallengeFailedError(`login User <${login}> with password`, req)
	}
}
/**
 * Send user info as JSON string
 * @param {import('lib/user.js').default} user
 * @returns {(res: import('express').Response) => undefined}
 */
function sendUserInfo(user) {
	const { info, userID } = user
	return res => res.status(statusCode.Success.OK).json({ userID, ...info })
}
