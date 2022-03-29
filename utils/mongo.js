import { MongoClient } from 'mongodb'
import { config } from 'lib/env.js'
/**
 * @typedef {Object} mongoConfig 
 * @property {String} password
 * @property {String} [database='ysyx']
 * @property {String} [host='127.0.0.1']
 * @property {Number} [post=27017]
 * @property {String} username
 */
// Breakdown mongo config from user config
const {
	username,
	password,
	host = '127.0.0.1',
	port = 27017,
	database,
	options = {}
} = config.mongo || {}
// Check for required fields
if (!(username && password && database)) {
	console.error('Bad mongo configuration', config.mongo)
	process.exit(1)
}
// Error indicating bad mongodb operation
export class DatabaseOperationError extends Error {}
export class DatabasePermissionError extends Error {}
/** 
* @param {mongoConfig} mongo configuration of mongodb
* @returns {String} mongodb connection url
*/
export const connectionString = `mongodb://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}`
/**
 * Merged options with defaults and user options
 * @type {import('mongodb').MongoClientOptions} - mongodb connect options
 */
export const connectionOptions = Object.freeze(Object.assign(
	{
		maxPoolSize: 10,
		minPoolSize: 2,
		connectTimeoutMS: 30000,
		useUnifiedTopology: true
	},
	options
))
/**
 * get connection to mongodb
 * @param {mongo} options - mongodb connect options
 * @param {(e: Error) => Any} onError
 * @return {Promise<Db>}
 */
export async function connect(onError = () => {}) {
	return await MongoClient
		.connect(connectionString, connectionOptions)
		.then(connection => connection.db(database))
		.catch(onError)
}

export class MongoCollection {
	#collectionName
	#collection
	#privileges = {
		C: false,
		R: true,
		U: false,
		D: false
	}
	/**
	 * Check if instance has appropriate access to given operation
	 * @param {'C' | 'R' | 'U' | 'D'} action 
	 */
	#access(action) {
		if (!this.#privileges[action])
			throw new DatabasePermissionError(`Process has no ${{
				C: 'insert',
				R: 'find',
				U: 'update',
				D: 'delete'
			}[action]} permission for collection ${this.#collectionName}`)
	}
	/**
	 * @param {import('mongodb').Db} connection 
	 * @param {String} collectionName 
	 * @param {String} privileges -"crud" 
	 * @constructor copy crud method from Db.collection(collectionName) 
	 */
	constructor(connection, collection, privileges) {
		this.#collectionName = collection
		this.#collection = connection.collection(collection)
		// Assign privileges to current connection instance
		privileges
			.toUpperCase()
			.split('')
			.forEach(char => {
				if (char in this.#privileges) this.#privileges[char] = true
			})
	}
	/**
	 * Insert into collection
	 * @param {import('mongodb').OptionalId<import('mongodb').Document>} arg 
	 * @param {import('mongodb').BulkWriteOptions} options -insert options
	 * @returns {Promise<import('mongodb').InsertOneResult> | Promise<import('mongodb').InsertManyResult>}
	 */
	async insert(arg, options) {
		// Check access privilege
		this.#access('C')
		// Select method according to input arguments
		if (Array.isArray(arg)) {
			return await this.#collection.insertMany(arg, options)
		} else if (arg && typeof arg === 'object') {
			return await this.#collection.insertOne(arg, options)
		} else {
			// No match between given argument type and expected argument types
			throw new DatabaseOperationError(`Bad arguments for db insert: [${{ arg, options }}]`)
		}
	}
	/**
	 * Find all entries from collection according to filter
	 * @param {import('mongodb').Filter<import('mongodb').Document>} filter 
	 * @param {import('mongodb').FindOptions} options 
	 * @returns {Promise<import('mongodb').FindCursor>}
	 */
	find(filter, options) {
		// Check access privilege
		this.#access('R')
		return this.#collection.find(filter, options)
	}
	/**
	 * Update document that matches 
	 * @param {import('mongodb').Filter<import('mongodb').Document>} filter 
	 * @param {import('mongodb').UpdateFilter<import('mongodb').Document>} updateFilter 
	 * @param {import('mongodb').UpdateOptions | {replace: Boolean}} options 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	update(filter, updateFilter, options) {
		// Check access privilege
		this.#access('U')
		// Select method according to input arguments
		if (updateFilter && typeof updateFilter === 'object') {
			if (options?.replace) return this.#collection.replaceOne(filter, updateFilter, options)
			return this.#collection.updateMany(filter, updateFilter, options)
		} else {
			// No match between given argument type and expected argument types
			throw new DatabaseOperationError(`Bad arguments for db insert: [${{ filter, updateFilter, options }}]`)
		}
	}
	/**
	 * 
	 * @param {import('mongodb').Filter<import('mongodb').Document>} filter 
	 * @param {import('mongodb').DeleteOptions} options 
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 */
	delete(filter, options) {
		// Check access privilege
		this.#access('D')
		// Select method according to input arguments
		return this.#collection.deleteMany(filter, options)
	}
	/**
	 * Create a watcher for this collection
	 * @param {import('mongodb').Document} pipeline 
	 * @param {import('mongodb').ChangeStreamOptions} options 
	 * @returns {import('mongodb').ChangeStream}
	 */
	watch(pipeline, options = {}) {
		// Check access privilege
		this.#access('R')
		// Select method according to input arguments
		return this.#collection.watch(pipeline, options)
	}
}

let retryCount = 5
async function onConnectionError(e) {
	if (--retryCount <= 0) {
		throw new Error('Reached maximum db connection count')
	} else {
		connection = await connect(config.mongo, onConnectionError)
		setTimeout(() => {
			retryCount ++
		}, 60_000)
	}
}
let connection = await connect(config.mongo, onConnectionError)
/**
 * @typedef {Object} dbClient
 * @property {MongoCollection} 

 * @param  {...String} collectionDescriptor -like 'example/CR/U/D'
 * @returns {Object.<string, MongoCollection>}
 * @description return value can be used like: value.collectionName.find() similar to db.collectionName.find()
 */
export default function dbInit(...collectionDescriptor) {
	// Initialize each descriptor to collection
	return Object.fromEntries(
		collectionDescriptor
			.filter(descriptor => !/^\s*(\/|$)/g.test(descriptor))
			.map(collectionString => {
				let [collectionName, privileges] = collectionString.split('/', 2)
				return [
					collectionName,
					new MongoCollection(connection, collectionName, privileges || 'R')
				]
			})
	)
}