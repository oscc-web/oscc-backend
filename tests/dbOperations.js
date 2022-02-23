// Test actions
import dbInit from '../utils/mongo.js'
import 'colors'
let db = await dbInit('test/cr')
let id = Date.now().toString(36)
// Test: normal read and write
// Test: has access to insert, returns as expected
console.log('Test: has access to insert, returns as expected'.green)
console.log(JSON.stringify(await db.test.insert({ _id: id, data: process.argv }), null, 2).blue)
// Test: has access to read, returns as expected
console.log('Test: has access to read, returns as expected'.green)
console.log(JSON.stringify((await db.test.find().toArray()), null, 2).blue)
// Test: no access to delete, will throw error
console.log('Test: no access to delete, will throw error'.green)
try {
	await db.test.delete({ _id: id })
} catch (e) {
	console.error(e.stack.red)
}
// Test: full access to 'test' database, do update and delete operations
console.log('Test: full access to database <test>, do update and delete operations'.green)
db = await dbInit('test/CRUD')
console.log('Test: first, update entry with updated: <DateString>'.green)
console.log(JSON.stringify((await db.test.update(
	{ _id: id },
	{
		$set: {
			updated: (new Date).toISOString()
		}
	})), null, 2).blue)
console.log(JSON.stringify((await db.test.find({ _id: id }).toArray()), null, 2).dim)
console.log('Test: then, delete this entry'.green)
console.log(JSON.stringify((await db.test.delete({ _id: id })), null, 2).blue)
console.log(JSON.stringify((await db.test.find({ _id: id }).toArray()), null, 2).dim)