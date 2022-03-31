import dbInit from 'utils/mongo.js'
import Test from './Test.js'
let db
const id = Date.now().toString(36)

new Test('create connection with C/R access')
	.run(async () => {
		return db = await dbInit('test/cr')
	})

new Test('has access to insert, returns as expected')
	.run(async () => {
		return await db.test.insert({
			_id: id,
			data: process.argv
		})
	})
	.expect({ acknowledged: true, insertedId: id })

new Test('has access to read, returns as expected')
	.run(async () => {
		return await db.test.find().toArray()
	})
	.expect(arr => arr.length > 0)

new Test('no access to delete, will throw error')
	.run(async () => {
		await db.test.delete({ _id: id })
	})
	.expect(Error)

new Test('full access to database <test>, do update and delete operations')
	.run(async () => {
		db = await dbInit('test/CRUD')
	})

new Test('first, update entry with updated: <DateString>')
	.run(async () => {
		return await db.test.update(
			{ _id: id },
			{ $set: { updated: (new Date).toISOString() } })
	})
	.expect(({ acknowledged, modifiedCount }) => acknowledged && modifiedCount)

new Test('then, find the entry')
	.run(async () => {
		return await db.test.find({ _id: id }).toArray()
	})
	.expect(arr => arr.length === 1)

new Test('finally, delete this entry')
	.run(async () => {
		return await db.test.delete({ _id: id })
	})
	.expect({ acknowledged: true, deletedCount: 1 })

new Test('check if this entry has really been deleted')
	.run(async () => {
		return await db.test.find({ _id: id }).toArray()
	})
	.expect(arr => arr.length === 0)
