// Environmental setup
import { init, logger } from '../lib/env.js'
init(import.meta)
// Test actions
import dbInit from '../lib/mongo.js'
let db = await dbInit('test/cr')
// Test: no access to delete, will throw error
try {
	await db.test.delete({ _id: '12sa45' })
} catch (e) {
	logger.error(e.stack)
}
// Test: has access to read, returns as expected
logger.info((await db.test.find().toArray()).toString())
// Test full access
db = await dbInit('')
console.log(db[''])