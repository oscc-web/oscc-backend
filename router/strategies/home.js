import express from 'express'
import bodyParser from 'body-parser'
import User from 'lib/user.js'
import logger from 'lib/logger.js'
import statusCode from 'lib/status.code.js'
import errorHandler from 'utils/errorHandler.js'
import Session, { SESSION_TOKEN_NAME } from 'lib/session.js'
import { config, Rx } from 'lib/env.js'
import { AppData } from 'lib/appData.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import withSession from 'lib/middleware/withSession.js'
import wrap from 'utils/wrapAsync.js'
// AppData for current scope
const appData = new AppData('@tmp')
/**
 * Server instance
 */
const server = express()
	.use(bodyParser.json({ type: req => req.method === 'POST' }))
	.use(withSession())
	.post('/login',
		wrap(async (req, res, next) => {
			const payload = req.body
			if (!payload || typeof payload !== 'object') {
				logger.errAcc(`Input: ${payload} is not an object`)
				return res.status(statusCode.ClientError.BadRequest).end()
			}
			const {
				login,
				password,
			} = payload
			const user = await User.locate(login)
			if (!(user instanceof User)) {
				logger.errAcc(`Unable to locate user with login <${login}>`)
			} else if (await user.login(password)) {
				await new Session(
					user,
					{
						persistent: false,
						initiator: req.headers?.['user-agent'],
						origin: req.origin
					}
				).writeToken(res)
				return wrap(sendUserInfo(user, res))
			} else {
				logger.errAcc(`Failed login attempt for ${user}`)
			}
			return res.status(statusCode.ClientError.Unauthorized).end()
		})
	)
	.post('/logout',
		wrap(async (req, res, next) => {
			const { session } = req
			if (session instanceof Session) {
				logger.access(`userID: <${session.userID}> logout`)
				session.drop()
			}
			res
				.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
				.status(statusCode.Success.OK)
				.end()
		})
	)
	.post('/register',
		(req, res, next) => {
			/**
			* @type {{ action: 'SEND_MAIL' | 'VALIDATE_TOKEN' | 'VALIDATE_USER_ID' | 'REGISTER', mail: String, userID: String, name: String, password: String, token: String }}
			*/
			const payload = req.body
			if (!payload || typeof payload !== 'object') {
				res.sendStatus(400)
			}
			let {
				action,
				mail,
				token
			} = payload
			// Convert mail to lower case
			if (!mail || typeof mail !== 'string' || !Rx.mail.test(mail)) {
				logger.errAcc(`Invalid mail: <${mail}>`)
				return res.status(statusCode.ClientError.BadRequest).end('[0] Bad mail')
			}
			mail = mail.toLowerCase()
			// Check if token exists
			switch (action) {
				case 'SEND_MAIL':
					wrap(async () => {
						if (await User.locate(mail)) {
							logger.verbose(`mail <${mail}> has already been registered`)
							return res.status(statusCode.ClientError.BadRequest).end('[1] Mail already used')
						}
						token = seed(6)
						appData
							.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
							.then(({ acknowledged } = {}) => {
								if (acknowledged) {
									const link = `/register?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
									return sendMail(mail, 'validateEmail', { link })
										.then(() => res.status(statusCode.Success.OK).end())
										.catch(e => {
											logger.error(`Error calling @mailer with args ${
												JSON.stringify({ mail, link })
											}: ${e.stack}`)
											res.status(statusCode.ServerError.InternalServerError).end('[X] Internal Server Error')
										})
								} else {
									logger.info(`Insert token<${token}> and mail<${mail}> Error`)
									return res.status(statusCode.ServerError.InternalServerError).end()
								}
							})
					})()
					break
				case 'VALIDATE':
					validateRegisterPayload(payload, res, () => {
						res.status(statusCode.Success.OK).end()
					})
					break
				case 'CREATE_ACCOUNT':
					validateRegisterPayload(payload, res, async ({ mail, userID, password, name }) => {
						const user = new User({ userID, mail, name })
						try {
							user.password = password
						} catch (e) {
							logger.errAcc(`[/register:CREATE_ACCOUNT] Illegal password (${typeof password}, length ${password.length})`)
							return res.status(statusCode.ClientError.BadRequest).end('[4] Bad password')
						}
						await user
							.update()
							.then(async () => {
								await appData.delete({ mail, action: 'validate-mail' })
								logger.access(`${user} created`)
							})
							.catch(e => {
								logger.info(`[/register:CREATE_ACCOUNT] Error creating user: ${e.stack}`)
								res.status(statusCode.ClientError.PaymentRequired).end()
							})
						res.status(statusCode.Success.OK).end()
					})
					break
				default:
					// Action is not supported, signal BadRequest
					logger.errAcc(`Unknown action <${action}>`)
					res.status(statusCode.ClientError.BadRequest).end()
			}
		}
	)
	.post('/user', (req, res, next) => {
		const { session } = req
		if (session instanceof Session) {
			wrap(sendUserInfo(session.user, res))
		} else {
			res.status(statusCode.ClientError.NotFound).end()
		}
	})
	.use(errorHandler)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)
/**
 * Send user info as JSON string
 * @param {User} user
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function sendUserInfo(user, res) {
	const { info, userID } = await user
	return res.json({ userID, ...info })
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
async function validateRegisterPayload(payload, res, next) {
	const { mail, token, userID, ...args } = payload
	const content = await appData.load({ mail, action: 'validate-mail' })
	logger.info(content)
	if (!content || content.token !== token) {
		logger.errAcc(`Failed to validate token <${token}> attached with mail <${mail}>`)
		return res.status(statusCode.ClientError.BadRequest).end('[1] Token not valid')
	} else {
		if (typeof userID === 'string') {
			if (!Rx.ID.test(userID)) {
				logger.errAcc(`[/register] validateRegisterPayload: illegal userID '${userID}'`)
				return res
					.status(statusCode.ClientError.BadRequest)
					.end('[2] Illegal userID')
			} else if (await User.locate(userID)) {
				logger.errAcc(`[/register] validateRegisterPayload: [User <${userID}>]' already exist`)
				return res
					.status(statusCode.ClientError.BadRequest)
					.end('[3] User already exist')
			}
		}
		// Validation passed
		next({ mail, token, userID, ...args })
	}
}
