import dbInit from '../utils/mongo.js'
import Test from './Test.js'
let db
let id = Date.now().toString(36)
new Test('create connection with C/R access').$(async () => {
	return db = await dbInit('test/cr')
})
new Test('has access to insert, returns as expected').$(async () => {
	return await db.test.insert({ _id: id, data: process.argv })
})
new Test('has access to read, returns as expected').$(async () => {
	return await db.test.find().toArray()
})
new Test('no access to delete, will throw error', Error).$(async () => {
	await db.test.delete({ _id: id })
})
new Test('full access to database <test>, do update and delete operations').$(async () => {
	db = await dbInit('test/CRUD')
})
new Test('first, update entry with updated: <DateString>').$(async () => {
	return await db.test.update(
		{ _id: id },
		{
			$set: {
				updated: (new Date).toISOString()
			}
		})
})
new Test('then, find the entry', arr => arr.length === 1).$(async () => {
	return await db.test.find({ _id: id }).toArray()
})
new Test('finally, delete this entry', ({ deletedCount }) => deletedCount === 1).$(async () => {
	return await db.test.delete({ _id: id })
})
new Test('check if this entry has really been deleted', arr => arr.length === 0).$(async () => {
	return await db.test.find({ _id: id }).toArray()
})