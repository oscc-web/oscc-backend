import { AppData } from 'lib/appData.js'
import { Rx } from 'lib/env.js'
import { ArgumentFormatError, BadRequestError, ChallengeFailedError, ConflictEntryError, InvalidOperationError, OperationFailedError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import User from 'lib/user.js'
import { seed } from 'utils/crypto.js'
import { success } from './response.js'
import { sendMail } from '../../modules/mailer/lib.js'
// AppData for current scope
const tmpAppData = new AppData('@tmp')
// The request handler
export default async function registerRequestHandler(req) {
	const { body } = req
	if (!body || typeof body !== 'object') throw new BadRequestError(
		'json body', body, req
	)
	/**
	* @type {{
	* 	action: 'SEND_MAIL' | 'VALIDATE_TOKEN' | 'VALIDATE_USER_ID' | 'REGISTER',
	* 	mail: String,
	* 	token: String
	* 	userID: String,
	* 	password: String,
	* 	name: String,
	* }}
	*/
	const { action, token, userID, password, name } = body,
		mail = body?.mail?.toLowerCase() || undefined
	// Convert mail to lower case, check mail availability
	if (
		!mail
		|| typeof mail !== 'string'
		|| !Rx.mail.test(mail)
	) throw BadRequestError('valid mail address', mail, req)
	// Check if token exists
	switch (action) {
		case 'SEND_MAIL': {
			await challengeRegisterPayload(req, { mail })
			const token = seed(6),
				{ acknowledged } = await tmpAppData
					.store(
						// Identifier
						{ mail, action: 'validate-mail' },
						// Content
						{ token },
						// Config
						{ replace: true }
					) || {}
			if (acknowledged) {
				await sendMail(mail, 'validateEmail', {
					link: `/register?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
				})
				return success
			} else throw new OperationFailedError(
				`store ${
					JSON.stringify({ mail, action: 'validate-mail', token })
				} into ${tmpAppData}`,
				req
			)
		}
		case 'VALIDATE':
			await challengeRegisterPayload(req, body)
			return success
		case 'CREATE_ACCOUNT': {
			await challengeRegisterPayload(req, body)
			const user = new User({ userID, mail, name })
			// Let user's password setter check if password is legal
			// Expecting ArgumentFormatError if password is illegal
			user.password = password
			await user.update()
			await tmpAppData.delete({ mail, action: 'validate-mail' })
			logger.info(`${user} created`)
			return success
		}
		default:
			throw InvalidOperationError(action, req)
	}
}
/**
 * Check for email validation token and optionally userID
 * @param {{
 * 	mail: String,
 * 	token: String,
 * 	userID: String | null
 * }} payload
 * @param {import('express').Response} res
 * @param {function({
 * 	mail: String,
 * 	token: String,
 * 	userID: String | null
 * }): Any} next
 */
async function challengeRegisterPayload(req, { mail, token, userID }) {
	if (!token && !userID) {
		// Only challenge mail
		const existingUser = await User.locate(mail)
		if (existingUser instanceof User) throw new ConflictEntryError(
			existingUser, `User <${mail}>`, req
		)
	} else if (
		token === (await tmpAppData.load({ mail, action: 'validate-mail' }))?.token
	) {
		if (typeof userID === 'string') {
			// Check if userID exists
			if (!Rx.ID.test(userID)) throw new ArgumentFormatError(
				'userID', userID, req
			)
			// Check if there is already a user with given userID
			const existingUser = await User.locate(userID)
			if (existingUser instanceof User) throw new ConflictEntryError(
				existingUser, `User <${userID}>`, req
			)
		}
	} else throw new ChallengeFailedError(
		`validate token <${token}> attached with mail <${mail}>`,
		req
	)
}
