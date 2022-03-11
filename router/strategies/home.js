import express from 'express'
import bodyParser from 'body-parser'
import Session, { SESSION_TOKEN_NAME } from '../../lib/session.js'
import User from '../../lib/user.js'
import { logger, config } from '../../lib/env.js'
import http from 'http'
import { AppData } from '../../lib/appData.js'
import { seed } from '../../utils/crypto.js'
// Announce express server instance
let appData = new AppData()
let IDRegex = /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/,
	mailRegex = /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/
/**
 * @type {import('express').Express}
 */
const server = express()
	.use(bodyParser.json())
	.post('/login',
		async (req, res, next) => {
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				logger.errAcc(`Input: ${payload} is not an object`)
				res.sendStatus(400)
			}
			let {
				userID,
				password,
			} = payload
			let user = await User.locate(userID)
			if (!(user instanceof User)) {
				logger.errAcc(`Unable to locate user with userID: <${userID}>`)
				return res.json({ login: false })
			}
			if (await user.login(password)) {
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
				return res.json({ login: false })
			}
		}
	)
	.get('/logout',
		async (req, res, next) => {
			let session = await Session.locate(req)
			if (session instanceof Session) {
				logger.access(`userID: <${session.userID}> logout`)
				session.drop()
			}
			res
				.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
				.writeHead(200)
				.end()
		}
	)
	.post('/register',
		async (req, res, next) => {
			/**
			* @type {{ action: 'VALIDATE_MAIL' | 'VALIDATE_TOKEN' | 'VALIDATE_USER_ID' | 'REGISTER', mail: String, userID: String, name: String, password: String, token: String }}
			*/
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				res.sendStatus(400)
			}
			let {
				action,
				userID,
				name,
				mail,
				password,
				token
			} = payload
			// check if token exists
			if (action === 'VALIDATE_MAIL') {
				if (!mail || !(typeof mail === 'string') || !mailRegex.test(mail)) {
					logger.errAcc(`Invalid mail: <${mail}>`)
					return res.json({ valid: false, msg: 'Invalid mail' })
				}if (await User.locate(mail)) {
					logger.verbose(`mail: <${mail}> has already been registered`)
					return res.json({ valid: false, msg: 'Mail has been registered' })
				}
				let query = await appData.load({ mail, action: 'validate-mail' })
				if (query) {
					sendMail(mail, query.token)
					return res.send({ valid: true })
				}
				let registerToken = seed(6),
					result = await appData.store({ token: registerToken }, { mail, action: 'validate-mail' })
				if (result?.acknowledged) {
					sendMail(mail, registerToken)
					return res.send({ valid: true })
				} else {
					logger.info(`Insert token<${token}> and mail<${mail}> Error`)
					return res.sendStatus(500)
				}
			} else if (action === 'VALIDATE_TOKEN') {
				return validateToken(mail, token).then(result => res.json(result))
			} else if (action === 'VALIDATE_USER_ID') {
				return validateUserID(userID).then(result => res.json(result))
			} else if (action === 'REGISTER') {
				let validateTokenResult = await validateToken(mail, token)
				if (!validateTokenResult.valid) {
					return res.json(validateTokenResult)
				}
				let validateUserIDResult = await validateUserID(userID)
				if (!validateUserIDResult.valid) {
					return res.json(validateUserIDResult)
				}
				if (!name || !(typeof name === 'string') || !password || !(typeof password === 'string')) {
					logger.errAcc(`Name: <${name}> and password: <${password}> must be strings`)
					return res.json({ register: false, msg: 'Name and password must be strings' })
				}
				let user = new User({ userID, name, mail })
				await user
					.update()
					.then(async () => {
						user.password = password
						res.json({ valid: true })
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
							template: 'registerEmail',
							to: mail,
							args: {}
						}))
						mailerReq.end()
						await appData.delete({ mail, action: 'validate-mail'})
						logger.access(`User ${user} successfully registered`)
					})
					.catch(e => {
						logger.info(`create user error: ${e.stack}`)
						res.sendStatus(500)
					})
			} else {
				logger.errAcc(`Unknown action provided <${action}>`)
				return res.sendStatus(404)
			}
		}
	)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)
async function validateUserID(userID) {
	if (!userID || !(typeof userID === 'string') || !IDRegex.test(userID)) {
		logger.errAcc(`Invalid userID: <${userID}>`)
		return { valid: false, msg: 'Invalid userID' }
	}
	if (await User.locate(userID)) {
		logger.errAcc(`userID: <${userID}> has already been registered`)
		return { valid: false, msg: 'userID has already been registered' }
	}
	return { valid: true }
}
async function validateToken(mail, token) {
	let content = await appData.load({ mail, action: 'validate-mail' })
	if (!content || content.token !== token) {
		logger.errAcc(`token <${token}> cannot match the one bound to the mail <${mail}> in the database`)
		return { valid: false, msg: 'Invalid token' }
	}
	return { valid: true }
}
async function sendMail(mail, token){
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
		args: { link: `ysyx.org/register?token=${token}&mail=${Buffer.from(mail).toString('base64')}` }
	}))
	mailerReq.end()
}