// Test actions
import User from '../lib/user.js'
import 'colors'
const TIME_OUT = 500
// Generate parameters for test purpose
let userID = Date.now().toString(36),
	name = 'Test User',
	mail = 'demo@ysyx.org',
	OAuthTokens = {},
	groups = []
try {
	// ----------------------------------------------------------------------------
	console.log('Test: create user'.green)
	let user = new User({
		_id: userID, name, mail, OAuthTokens, groups
	})
	console.log(JSON.stringify(user.info).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: write to database'.green)
	console.log(await user.update())
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: get user info string (no cache)'.green)
	console.log(user.infoString.blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: set password <a1b2c3d4>'.green)
	user.password = 'a1b2c3d4'
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: login with correct password'.green)
	console.log(JSON.stringify(user.login('a1b2c3d4')).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: login with incorrect password'.green)
	console.log(JSON.stringify(user.login('wrongPassw0rd')).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: get user info string (no cache)'.green)
	console.log(user.infoString.blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: get user info string (cached)'.green)
	console.log(user.infoString.blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: change user name'.green)
	console.log((user.name = 'Test User 222').blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: locate user from database'.green)
	console.log(JSON.stringify((await User.locate(userID)) instanceof User).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: login from database'.green)
	console.log(JSON.stringify((await User.locate(userID)).login('a1b2c3d4')).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: change user password'.green)
	console.log(JSON.stringify((await User.locate(userID)).password = '123321').blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: login again'.green)
	console.log(JSON.stringify((await User.locate(userID)).login('123321')).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
	// ----------------------------------------------------------------------------
	console.log('Test: login again (incorrect)'.green)
	console.log(JSON.stringify((await User.locate(userID)).login('a1b2c3d4')).blue)
	await new Promise(res => setTimeout(() => res(), TIME_OUT))
} catch (e) {
	console.log(e.stack.red)
}
console.log('Test end, clean up database'.green)
User.db.user.delete({ _id: userID })
