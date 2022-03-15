import express from 'express'
import bodyParser from 'body-parser'
import User from '../../lib/user.js'
import http from 'http'
import statusCode from '../../lib/status.code.js'
import Session, { SESSION_TOKEN_NAME } from '../../lib/session.js'
import { logger, config, Rx } from '../../lib/env.js'
import { AppData } from '../../lib/appData.js'
import { seed } from '../../utils/crypto.js'
import errorHandler from '../middleware/errorHandler.js'
// AppData for current scope
let appData = new AppData('router/home')
/**
 * Server instance
 */
const server = express()
	.use(bodyParser.json({ type: req => req.method === 'POST' }))
	.post('/login',
		async (req, res, next) => {
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				logger.errAcc(`Input: ${payload} is not an object`)
				return res.status(statusCode.ClientError.BadRequest).end()
			}
			let {
				login,
				password,
			} = payload
			let user = await User.locate(login)
			if (!(user instanceof User)) {
				logger.errAcc(`Unable to locate user with login <${login}>`)
			}
			else if (await user.login(password)) {
				await new Session(
					user,
					{
						persistent: false,
						initiator: req.headers?.['user-agent'],
						origin: req.origin
					}
				).writeToken(res)
				return res.json({ login: true, userInfo: JSON.stringify(user.info) })
			} else {
				logger.errAcc(`Failed login attempt for ${user}`)
			}
			return res.status(statusCode.ClientError.Unauthorized).end()
		}
	)
	.post('/logout',
		async (req, res, next) => {
			let session = await Session.locate(req)
			if (session instanceof Session) {
				logger.access(`userID: <${session.userID}> logout`)
				session.drop()
			}
			res
				.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
				.status(statusCode.Success.OK)
				.end()
		}
	)
	.post('/register',
		(req, res, next) => {
			/**
			* @type {{ action: 'SEND_MAIL' | 'VALIDATE_TOKEN' | 'VALIDATE_USER_ID' | 'REGISTER', mail: String, userID: String, name: String, password: String, token: String }}
			*/
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				res.sendStatus(400)
			}
			let {
				action,
				mail,
				token
			} = payload
			// Convert mail to lower case
			if (!mail || (typeof mail !== 'string') || !Rx.mail.test(mail)) {
				logger.errAcc(`Invalid mail: <${mail}>`)
				return res.status(statusCode.ClientError.BadRequest).end('[0] Bad mail')
			}
			mail = mail.toLowerCase()
			// check if token exists
			switch (action) {
				case 'SEND_MAIL':
					(async () => {
						if (await User.locate(mail)) {
							logger.verbose(`mail <${mail}> has already been registered`)
							return res.status(statusCode.ClientError.BadRequest).end('[1] Mail already used')
						}
						token = seed(6)
						appData
							.store({ token }, { mail, action: 'validate-mail' }, { replace: true })
							.then(({ acknowledged } = {}) => {
								if (acknowledged) {
									let mailerReq = http.request(
										{
											hostname: '127.0.0.1',
											port: config.port.mailer,
											method: 'POST',
											headers: {
												'Content-Type': 'application/json',
											}
										}
									)
									mailerReq.write(JSON.stringify({
										template: 'validateEmail',
										to: mail,
										args: { link: `/register?token=${token}&mail=${Buffer.from(mail).toString('base64')}` }
									}))
									mailerReq.end()
									return res.status(statusCode.Success.OK).end()
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
					validateRegisterPayload(payload, res, async ({ mail, userID, password }) => {
						const user = new User({ userID, mail })
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
					// action is not supported, signal BadRequest
					logger.errAcc(`Unknown action <${action}>`)
					res.status(statusCode.ClientError.BadRequest).end()
			}
		}
	)
	.use(errorHandler)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)
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
	let content = await appData.load({ mail, action: 'validate-mail' })
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
			}
			else if (await User.locate(userID)) {
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