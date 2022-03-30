import Test from './Test.js'
import Session from 'lib/session.js'
import User from 'lib/user.js'
import DBInit from 'utils/mongo.js'
import express from 'express'
// Generate parameters for test
let userID = Date.now().toString(36),
	name = 'Test User',
	mail = 'demo@ysyx.org',
	OAuthTokens = {},
	groups = [],
	token,
	/**
	 * @type {Session}
	 */
	session,
	/**
	 * @type {User}
	 */
	user

new Test('create a temporary for session test')
	.run(async () => {
		user = new User({
			_id: userID, name, mail, OAuthTokens, groups
		})
		// We are skipping password because we do not need to run user.login()
		await user.update()
		return { userID: user.userID, info: user.info }
	})

new Test('create a session with user instance')
	.run(async () => {
		session = new Session(user, { initiator: 'development test' })
		token = await session.token
		return session.valid && session.user === user
	})
	.expect(true)

new Test('session preprocessor')
	.run(async () => {
		return await new Promise(resolve => {
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
	})

new Test('drop session and try accessing it again (expected: session = null)')
	.run(async () => {
		await session.drop()
		return await new Promise(resolve => {
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
		})
	})
	.expect(null)

new Test('cleanup session table')
	.run(async () => {
		let db = DBInit('session/CRUD')
		return await db.session.delete({ token })
	})
	.expect({ acknowledged: true, deletedCount: 0 })

new Test('cleanup session table')
	.run(async () => {
		let db = DBInit('user/CRUD')
		return await db.user.delete({ _id: user.userID })
	})
	.expect({ acknowledged: true, deletedCount: 1 })
