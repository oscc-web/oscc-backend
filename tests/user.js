// Test actions
import User from 'lib/user.js'
import { seed } from 'utils/crypto.js'
import Test from './Test.js'
// Generate parameters for test purpose
const userID = seed(12),
	name = 'Test User',
	mail = 'demo@ysyx.org',
	OAuthTokens = {},
	groups = ['root']
	/**
	 * @type {User}
	 */
let user
new Test('create user')
	.run(() => {
		user = new User({ _id: userID, name, mail, OAuthTokens, groups })
		return [user instanceof User, user.info]
	})
	.expect(([_]) => _)

new Test('write to database')
	.run(async () => {
		return await user.update()
	})
	.expect(true)

new Test('get user info')
	.run(async () => {
		return user.info
	})
	.expect(_ => typeof _ === 'object')

new Test('set password <a1b2c3d4>')
	.run(async () => {
		return user.password = 'a1b2c3d4'
	})
	.expect(_ => typeof _ === 'string')

new Test('login with correct password')
	.run(async () => {
		return await user.login('a1b2c3d4')
	})
	.expect(true)

new Test('login with incorrect password')
	.run(async () => {
		return await user.login('wrongPassword')
	})
	.expect(false)

new Test('get user info')
	.run(async () => {
		return user.info
	})
	.expect(_ => typeof _ === 'object')

new Test('change user name')
	.run(async () => {
		user.name = name
		return await user.name
	})
	.expect('Test User 222')

new Test('locate user from database')
	.run(async () => {
		return await User.locate(userID)
	})
	.expect(User)

new Test('login from database')
	.run(async () => {
		user = await User.locate(userID)
		return await user.login('a1b2c3d4')
	})
	.expect(true)

new Test('change user password')
	.run(async () => {
		user.password = '123321'
	})

new Test('login again')
	.run(async () => {
		return await user.login('123321')
	})
	.expect(true)

new Test('login again (incorrect)')
	.run(async () => {
		return await user.login('a1b2c3d4')
	})
	.expect(false)

new Test('cleanup database')
	.run(async () => {
		return await User.db.user.delete({ _id: userID })
	})
	.expect({ acknowledged: true, deletedCount: 1 })
