import express from 'express'
import Session, { SESSION_TOKEN_NAME } from '../../lib/session.js'
import User from '../../lib/user.js'
// Announce express server instance
/**
 * @type {import('express').Express}
 */
const server = express()
	.get('/login',
		Session.preprocessor,
		async (req, res, next) => {
			let user = await User.locate('zhangyx')
			await new Session(
				user,
				{
					persistent: false,
					initiator: req.headers?.['user-agent'],
					origin: req.origin
				}
			).writeToken(res)
			res.end('login')
		}
	)
	.get('/logout',
		Session.preprocessor,
		async (req, res, next) => {
			(await Session.locate(req)).drop()
			res.cookie(SESSION_TOKEN_NAME, '', { expires: new Date(0) })
			res.redirect('/')
		}
	)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)