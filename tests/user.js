// Test actions
import User from '../lib/user.js'
import Test from './Test.js'
// Generate parameters for test purpose
let userID = Date.now().toString(36),
	name = 'Test User',
	mail = 'demo@ysyx.org',
	OAuthTokens = {},
	groups = [],
	/**
	 * @type {User}
	 */
	user
// ----------------------------------------------------------------------------
new Test('create user', ([_]) => _).$(() => {
	user = new User({
		_id: userID, name, mail, OAuthTokens, groups
	})
	return [user instanceof User, user.info]
})
// ----------------------------------------------------------------------------
new Test('write to database').$(async () => {
	return await user.update()
})
// ----------------------------------------------------------------------------
new Test('write to database').$(async () => {
	return await user.update()
})
// ----------------------------------------------------------------------------
new Test('get user info string (no cache)').$(async () => {
	return user.infoString
})
// ----------------------------------------------------------------------------
new Test('set password <a1b2c3d4>').$(async () => {
	return user.password = 'a1b2c3d4'
})
// ----------------------------------------------------------------------------
new Test('login with correct password', true).$(async () => {
	return await user.login('a1b2c3d4')
})
// ----------------------------------------------------------------------------
new Test('login with incorrect password', false).$(async () => {
	return await user.login('wrongPassw0rd')
})
// ----------------------------------------------------------------------------
new Test('get user info string (no cache)', _ => typeof _ === 'string').$(async () => {
	return user.infoString
})
// ----------------------------------------------------------------------------
new Test('get user info string (cached)', _ => typeof _ === 'string').$(async () => {
	return user.infoString
})
// ----------------------------------------------------------------------------
new Test('change user name', name = 'Test User 222').$(async () => {
	user.name = name
	return await user.name
})
// ----------------------------------------------------------------------------
new Test('locate user from database', _ => _ instanceof User).$(async () => {
	return await User.locate(userID)
})
// ----------------------------------------------------------------------------
new Test('login from database', true).$(async () => {
	return await (await User.locate(userID)).login('a1b2c3d4')
})
// ----------------------------------------------------------------------------
new Test('change user password').$(async () => {
	(await User.locate(userID)).password = '123321'
})
// ----------------------------------------------------------------------------
new Test('login again', true).$(async () => {
	return await (await User.locate(userID)).login('123321')
})
// ----------------------------------------------------------------------------
new Test('login again (incorrect)', false).$(async () => {
	return await (await User.locate(userID)).login('a1b2c3d4')
})
// ----------------------------------------------------------------------------
new Test('cleanup database', ({ deletedCount }) => deletedCount === 1).$(async () => {
	return await User.db.user.delete({ _id: userID })
})