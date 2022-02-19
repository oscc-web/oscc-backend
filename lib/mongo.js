import { MongoClient, Db } from 'mongodb'
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
	#collection
	#privileges = {
		C: false,
		R: true,
		U: false,
		D: false
	}
	hasAccess(action) {
		return !!this.#privileges[action]
	}
	/**
	 * 
	 * @param {Db} connection 
	 * @param {String} collectionName 
	 * @param {String} privileges -"crud" 
	 * @constructor copy crud method from Db.collection(collectionName) 
	 */
	constructor(connection, collection, privileges) {
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
		// Check if current connection has appropriate access privilege
		if (!this.#privileges.C) throw new Error('Unprivileged access to insert operation')
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
		// Check if current connection has appropriate access privilege
		if (!this.#privileges.R) throw new Error('Unprivileged access to find operation')
		return this.#collection.find(filter, option)
	}

	update(filter, updateFilter, option) {
		// Check if current connection has appropriate access privilege
		if (!this.#privileges.U) throw new Error('Unprivileged access to update operation')
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
		// Check if current connection has appropriate access privilege
		if (!this.#privileges.D) throw new Error('Unprivileged access to delete operation')
		// Select method according to input arguments
		return this.#collection.deleteMany(filter, option)
	}
}

let connection
/**
 * @typedef {Object} dbClient
 * @property {MongoCollection} 
 * 
 * @param  {...String} collectionDescriptor -like 'example/CR/U/D'
 * @return {Object} 
 * @description return value can be used like: value.collectionName.find() similar to db.collectionName.find()
 */
export default async function init(...collectionDescriptor) {
	// Lazy-load database connection
	if (!(connection instanceof Db)) {
		connection = await connect(config.mongodb)
	}
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