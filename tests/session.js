import Session from '../lib/session.js'
import User from '../lib/user.js'
import DBInit from '../utils/mongo.js'
import { init } from '../lib/env.js'
import express from 'express'
import 'colors'
init(import.meta)
const TIME_OUT = 500
// Generate parameters for test purpose
let userID = Date.now().toString(36),
	name = 'Test User',
	mail = 'demo@ysyx.org',
	OAuthTokens = {},
	groups = [],
	token
console.log('Creating test user'.green)
let user = new User({
	_id: userID, name, mail, OAuthTokens, groups
})
user.password = '123321'
await new Promise(res => setTimeout(() => res(), TIME_OUT))
await user.update()
console.log(user.userID, user.infoString.dim)
try {
	// ----------------------------------------------------------------------------
	console.log('Test: create a session with user instance'.green)
	let session = new Session(user, { initiator: 'Apple, Webkit, Mozilla' })
	console.log((await session.init()).valid)
	console.log(session.user === user)
	console.log(('Token is ' + (token = session.token)).blue)
	// ----------------------------------------------------------------------------
	console.log('Test: retract session using Session.locate'.green)
	let retractedSession = await new Promise(resolve => {
		let server = express().use(
			Session.preprocessor,
			async (req, res) => {
				// Log internal cookies injected by Session preprocessor
				console.log(('internalCookies: ' + JSON.stringify(req.internalCookies)).blue)
				// End request
				res.writeHead(200).end()
				// Retract session result
				let result = await Session.locate(req)
				if (result instanceof Session) {
					server.close()
					resolve(result)
				} else {
					console.log(`No matched session: ${JSON.stringify(req.parsedCookies)}`.red.underline)
				}
			}
		).listen(8888, () => {
			console.log(`Express setup at port 8888 with token=${token}`.yellow)
		})
	})
	console.log(('Retracted session: ' + JSON.stringify({
		token: retractedSession?.token,
		user: retractedSession?.user.info,
		valid: retractedSession?.valid
	}, null, 2)).blue)
	// ----------------------------------------------------------------------------
	console.log('Test: drop session and try accessing it again (expected: session = null)'.green)
	console.log(JSON.stringify(await session.drop()).blue)
	console.log('session =', await new Promise(resolve => {
		let server = express().use(
			Session.preprocessor,
			(req, res) => {
				res.writeHead(200).end()
				server.close()
				resolve(Session.locate(req))
			}
		).listen(8888, () => {
			console.log(`Access port 8888 again with token=${token}`.yellow)
		})
	}))
} catch (e) {
	console.log(e.stack.red)
}
let db = DBInit('session/CRUD', 'user/CRUD')
console.log('Clean up session table (expected to delete NO entry)'.green)
console.log(await db.session.delete({ token }))
console.log('Clean up user table'.green)
console.log(await db.user.delete({ _id: user.userID }))
process.exit(0)
