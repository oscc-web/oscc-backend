import Test from './Test.js'
import fs from 'fs-extra'
import { AppData, AppDataWithFs } from 'lib/appData.js'
import { seed } from 'utils/crypto.js'
import { PROJECT_ROOT } from 'lib/env.js'
import User from 'lib/user.js'

let appID = 'testAppID',
	user = new User({ userID: seed(12) }),
	/**
	 * @type {AppData}
	 */
	appData
new Test('create appData')
	.run(() => {
		appData = new AppData(appID)
		return appData instanceof AppData
	})
	.expect(true)
new Test('insert appData')
	.run(async () => {
		return (await appData.store({ msg: 'Test app message' }, { user, appID })).acknowledged
	})
	.expect(true)
new Test('load appData')
	.run(async () => {
		return (await appData.load({ user, appID })).msg
	})
	.expect('Test app message')
new Test('update appData')
	.run(async () => {
		return (await appData.update({ msg:'Updated app message' }, { user, appID })).acknowledged
	})
	.expect(true)
new Test('load appData after updating')
	.run(async () => {
		return await (await appData.load({ user, appID })).msg
	})
	.expect('Updated app message')
new Test('delete appData')
	.run(async () => {
		return (await appData.delete({ user, appID })).acknowledged
	})
	.expect(true)
let fileID = 'testFile'
appID = 'testFileAppID'
user = new User({ userID: seed(12) })
let text ='test file string'
new Test('create AppDataWithFs')
	.run(() => {
		appData = new AppDataWithFs(appID)
		return appData instanceof AppDataWithFs
	})
	.expect(true)
new Test('insert a file')
	.run(async () => {
		fs.writeFileSync(`${PROJECT_ROOT}/tmp/${fileID}`, text)
		return (await appData.store({ msg: 'Test file app message', cTime: new Date().getTime(), temp: true, for: 'test', fileID }, { user, appID })).acknowledged
	})
	.expect(true)
new Test('acquireFile')
	.run(async () => {
		return (await appData.acquireFile( { user, appID })).fileID
	})
	.expect('testFile')
new Test('loadFile')
	.run(async () => {
		return (await appData.loadFile({ user, appID })).toString()
	})
	.expect(text)
new Test('deleteFile')
	.run(async () => {
		return (await appData.deleteFile({ user, appID })).acknowledged
	})
	.expect(true)
new Test('acquireFile after delete')
	.run(async () => {
		return (await appData.acquireFile({ user, appID }))
	})
	.expect(null)
new Test('Test end')
	.run(async () => {
		await appData.delete({ user, appID })
		fs.removeSync(`${PROJECT_ROOT}/tmp/${fileID}`)
	})
