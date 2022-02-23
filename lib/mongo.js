import { MongoClient } from 'mongodb'
import ld from 'lodash'
import { logger, config } from './env.js'
const { _ } = ld

/**
 * @typedef {Object} mongo 
 * @property {String} host - mongodb hostname default 127.0.0.1
 * @property {String} port - mongodb port default 27017
 * @property {String} database  mongodb database default ysyx 
 * 
 * 
 * @param {mongo} mongo - configuration of mongodb
 * @return {String} - mongodb connection url
 */
export function getConnectionString(mongo) {
	let usernamePassword = ''
	if (mongo.username && mongo.password) {
		usernamePassword = `${mongo.username}:${encodeURIComponent(mongo.password)}@`
	} else {
		logger.warn('You have no mongo username/password setup!')
	}
	if (!mongo.host) {
		mongo.host = '127.0.0.1'
	}
	if (!mongo.port) {
		mongo.port = 27017
	}
	const dbName = mongo.database
	if (dbName === undefined || dbName === '') {
		logger.warn('You have no database name, using "ysyx"')
		mongo.database = 'ysyx'
	}

	const hosts = mongo.host.split(',')
	const ports = mongo.port.toString().split(',')
	const servers = []

	for (let i = 0; i < hosts.length; i += 1) {
		servers.push(`${hosts[i]}:${ports[i]}`)
	}
	return `mongodb://${usernamePassword}${servers.join()}/${mongo.database}`
}
/**
 * merge default options and mongodb.options
 * @typedef {Object} mongo 
 * @property {MongoClientOptions} options
 * @param {mongo} mongo - mongodb connect options
 * @return {Object} - mongodb connect options
 */
export function getConnectionOptions(mongo) {
	const connectionOptions = {
		maxPoolSize: 10,
		minPoolSize: 3,
		connectTimeoutMS: 90000,
	}
	return _.merge(connectionOptions, mongo.options || {})
}
/**
 * get connection to mongodb
 * 
 * 
 * @param {mongo} options - mongodb connect options
 * @return {Promise<Db>}
 */
export async function connect(options) {
	const connectionString = getConnectionString(options)
	const connectionOptions = getConnectionOptions(options)
	return await MongoClient
		.connect(connectionString, connectionOptions)
		.then(connection => connection.db(options.database))
		.catch(e => {
			logger.error('MongoClient disconnected: ' + e.stack)
		})
}

class MongoCollection {
	#collectionName
	#collection
	#privileges = {
		C: false,
		R: true,
		U: false,
		D: false
	}
	#access(action) {
		if (!this.#privileges[action])
			throw new Error(`Process has no ${{
				C: 'insert',
				R: 'find',
				U: 'update',
				D: 'delete'
			}[action]} privilege to collection ${this.#collectionName}`)
	}
	/**
	 * 
	 * @param {Db} connection 
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
	 * 
	 * @param {object} arg 
	 * @param {object} option -insert options
	 */
	insert(arg, option) {
		// Check access privilege
		this.#access('C')
		// Select method according to input arguments
		if (Array.isArray(arg)) {
			return this.#collection.insertMany(arg, option)
		}
		if (arg && typeof arg === 'object') {
			return this.#collection.insertOne(arg, option)
		}
		// No match between given argument type and expected argument types
		logger.warn(`Illegal input for insert: [${typeof arg} ${arg.toString()}, ${typeof option} ${option.toString()}]`)
		// Make no changes, return undefined
		return
	}

	find(filter, option) {
		// Check access privilege
		this.#access('R')
		return this.#collection.find(filter, option)
	}

	update(filter, updateFilter, option) {
		// Check access privilege
		this.#access('U')
		// Select method according to input arguments
		if (updateFilter && typeof updateFilter === 'object') {
			if (option?.replace) return this.#collection.replaceOne(filter, updateFilter, option)
			return this.#collection.updateMany(filter, updateFilter, option)
		}
		// No match between given argument type and expected argument types
		logger.warn(`Illegal input for update: [${typeof filter} ${filter.toString()}, ${typeof updateFilter} ${updateFilter.toString()}, ${typeof option} ${option.toString()}]`)
		// Make no changes, return undefined
		return
	}

	delete(filter, option) {
		// Check access privilege
		this.#access('D')
		// Select method according to input arguments
		return this.#collection.deleteMany(filter, option)
	}
}

let connection = await connect(config.mongodb)
/**
 * @typedef {Object} dbClient
 * @property {MongoCollection} 

 * @param  {...String} collectionDescriptor -like 'example/CR/U/D'
 * @returns {{
 *   user: MongoCollection,
 *   test: MongoCollection,
 *   userTmp: MongoCollection,
 *   session: MongoCollection,
 *   operations: MongoCollection,
 *   progressReport: MongoCollection
 * }}
 * @description return value can be used like: value.collectionName.find() similar to db.collectionName.find()
 */
export default function init(...collectionDescriptor) {
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