import express from 'express'
import bodyParser from 'body-parser'
import Session, { SESSION_TOKEN_NAME } from '../../lib/session.js'
import User from '../../lib/user.js'
import { logger, config } from '../../lib/env.js'
import http from 'http'
import { AppData } from '../../lib/appData.js'
import { seed } from '../../utils/crypto.js'
// Announce express server instance
/**
 * @type {import('express').Express}
 */
const server = express()
	.use(bodyParser.json())
	.post('/login',
		async (req, res, next) => {
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				logger.warn('Input is not an object')
				res.sendStatus(400)
			}
			let {
				userID,
				password,
			} = payload
			let user = await User.locate(userID)
			if (!(user instanceof User)){
				logger.errAcc(`Unable to locate user with userID: ${userID}`)
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
				return res.json({ login: true, userInfo: user.infoString })
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
				logger.access(`userID: ${session.userID} logout`)
				session.drop()
			} 
			res.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
			res.redirect('/')
		}
	)
	.get('/register', (req, res, next) => {
		res.redirect('/')
	})
	.post('/register',
		async (req, res, next) => {
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				res.sendStatus(400)
			}
			let appData = new AppData(),
				IDRegex = /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/,
				mailRegex = /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/
			// check if token exists
			if (!req.query?.token) {
				let { mail } = payload
				if (!mail || !(typeof mail === 'string') || !mailRegex.test(mail)) {
					logger.warn('Invalid mail')
					return res.json({ register: false, msg: 'Invalid mail' })
				}
				// generate token
				let token = seed(6),
					query = await appData.load({ mail, appID: appData.appID })
				if (query || (await User.locate(mail))){ 
					logger.verbose(`mail: <${mail}> has already been registered`)
					return res.json({ register: false, msg: 'Mail has been registered' })
				}
				let	result = await appData.store({ token }, { mail, appID: appData.appID })
				if (result?.acknowledged) {
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
						args:{ link: `ysyx.org/register?token=${token}` }
					}))
					mailerReq.end()
					return res.send()
				} else {
					logger.info(`Insert token<${token}> and mail<${mail}> Error`)
					return res.sendStatus(500)
				} 
			}
			let {
				userID,
				name,
				mail,
				password,
				OAuthTokens
			} = payload
			let registerToken = req.query.token,
				content = await appData.load({ mail, appID: appData.appID })
			if (!content || content.token !== registerToken) {
				logger.errAcc(`token <${registerToken}> cannot match the one bound to the mail <${mail}> in the database`)
				return res.send({ register:false, msg:'Invalid token' })
			}
			if (!userID || !(typeof userID === 'string') || !IDRegex.test(userID)) {
				logger.warn('Invalid userID')
				return res.json({ register: false, msg: 'Invalid userID' })
			}
			if (!mail || !(typeof mail === 'string') || !mailRegex.test(mail)) {
				logger.warn('Invalid mail')
				return res.json({ register: false, msg: 'Invalid mail' })
			}
			if (await User.locate(userID)) {
				logger.verbose(`userID: <${userID}> has already been registered`)
				return res.json({ register: false, msg: 'userID has already been registered' })
			}
			if (await User.locate(mail)) {
				logger.verbose(`mail: <${mail}> has already been registered`)
				return res.json({ register: false, msg: 'mail has already been registered' })
			}
			if (!name || !(typeof name === 'string') || !password || !(typeof password === 'string')) {
				logger.warn('Name and password must be strings')
				return res.json({ register: false, msg: 'Name and password must be strings' })
			}
			let user = new User({ userID, name, mail, OAuthTokens })
			await user
				.update()
				.then(async() => {
					user.password = password
					res.json({ register: true })
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
						args:{}
					}))
					mailerReq.end()
					await appData.delete({ mail, appID: appData.appID })
					logger.access(`User ${user} successfully registered`)
				})
				.catch(e => {
					logger.error(`create user error: ${e.stack}`)
					res.sendStatus(500)
				})
		}
	)
	.post('/exist',
		async (req, res, next) => {
			let payload = req.body
			if (!payload || typeof payload !== 'object') {
				logger.warn('Input is not an object')
				res.sendStatus(400)
			}
			let { userID, mail } = payload
			if (await User.locate(userID) || await User.locate(mail)) return res.json({ exist: true })
			return res.json({ exist: false })
		}) 
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)