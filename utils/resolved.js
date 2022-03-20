import CustomObject from './customObject.js'
import logger from '../lib/logger.js'
import wrap from './wrapAsync.js'
import { PID } from '../lib/env.js'

export default class Resolved extends CustomObject {
	/**
	 * @type {String} Name of the service awaiting resolution
	 */
	#serviceName
	get serviceName() { return this.#serviceName }
	/**
	 * @type {Function} Promise resolution callback
	 */
	#resolve
	/**
	 * @type {Boolean} Indicates if this promise has been resolved
	 */
	#resolved = false
	get resolved() { return this.#resolved }
	/**
	 * @type {Boolean} Indicates if this promise blocks Resolved.all
	 */
	#blocking = true
	/**
	 * @type {Promise} Named service resolution promise
	 */
	#promise
	get promise() {
		if (this.#blocking)
			return this.#promise
		else
			return true
	}
	/**
	 * @typedef {Object} ServiceDescriptor
	 * @property {String | '127.0.0.1'} hostname
	 * Target hostname of this service
	 * @property {Number} port
	 * Struct recording info of current service
	 */
	/**
	 * @type {ServiceDescriptor}
	 */
	#dsc = {}
	get url() {
		const { hostname = '127.0.0.1', port } = this.#dsc
		return `${hostname}:${port}`
	}
	/**
	 * The resolver will be called within wrapped proxy server,
	 * therefore there is no need to wrap it again.
	 * @type {import('../lib/middleware/proxy.js').Resolver}
	 */
	get resolver() {
		return async () => {
			if (!this.resolved) {
				logger.warn(`Calling resolver of ${this} before service resolution.`)
				await this.promise
			}
			return this.#dsc
		}
	}
	/**
	 * Create a new pending promise awaiting the resolution of
	 * a named service 
	 * @param {*} serviceName 
	 */
	constructor(serviceName, blocking = true) {
		super()
		this.#blocking = blocking
		this.#serviceName = serviceName
		logger.verbose(`${this} created`)
		this.#promise = new Promise(resolve => {
			this.#resolve = resolve
		}).then(() => {
			this.#resolved = true
			logger.verbose(`${this} has been resolved`)
		})
		Resolved.push(this)
	}
	/**
	 * @typedef {ServiceDescriptor} IpcMsg
	 * @property {String} service
	 * Name of the service of this incoming IpcMsg
	 */
	/**
	 * Check if incoming ipcMsg 
	 * @param {IpcMsg} ipcMsg
	 */
	evaluate(ipcMsg) {
		const { service, port, ...args } = ipcMsg
		if (service === this.#serviceName) {
			if (!port || (typeof port !== 'number'))
				return logger.warn(
					`Unexpected type port=<${typeof port}>${port} during resolution of ${this}, ignoring this message`
				)
			if (!this.resolved)
				this.#resolve(true)
			// Create new descriptor
			const dsc = { port, ...args }
			// Update current resolved service descriptor
			Object.assign(this.#dsc, dsc)
			// Log the update
			logger.info(`${this} => ${
				Object
					.entries(dsc)
					.map(([el, val])  => `${el}=${val}`)
					.join(' ')
			}`)
		}
	}
	/**
	 * @type {Resolved[]} List of all Resolved instances
	 */
	static #resolveList = []
	/**
	 * Send ipcMsg to all Resolved instance(s) for evaluation
	 * @param {IpcMsg} ipcMsg 
	 */
	static onMessage(ipcMsg) {
		const { $, service, $query, ...args } = ipcMsg
		// Check if this message is a resolve broadcast
		if ($ == this.name && !$query)
			this.#resolveList.forEach(resolved => resolved.evaluate({ service, ...args }))
	}
	/**
	 * Register a new resolved service into the list
	 * @param {Resolved} resolved 
	 */
	static push(resolved) {
		if (!(resolved instanceof this)) throw new TypeError
		this.#resolveList.push(resolved)
		// Query for existing service with a delay of 1 second
		setTimeout(() => {
			if (!this.resolved)
				this.ipcCall({ $query: true, service: resolved.serviceName })
		}, 1000)
	}
	/**
	 * @type {Promise<boolean>}
	 */
	static get all() {
		return Promise
			.all(this.#resolveList.map(resolved => resolved.promise))
			.then(arr => arr.reduce((a, b) => a && b, true))
	}
	/**
	 * Send an IPC broadcast to all sibling processes
	 * @param {import('http').Server} server 
	 * @param {String} name
	 * @returns {Promise<Number>} port number
	 */
	static async launch(server, name = PID) {
		await new Promise(res => server = server.listen(0, res))
		const { port } = server.address()
		const announcement = { service: name, port }
		this.ipcCall(announcement)
		// Listen for later initialized service query
		process.on('message', ({ $, $query, service }) => {
			if ($ === this.name && $query && name === service)
				this.ipcCall(announcement)
		})
		// Log the launched server
		logger.info(`Service up and running at port ${port}`)
		// Return the port number
		return port
	}
	static ipcCall({ ...args }) {
		try {
			process.send({
				...args,
				$: this.name
			})
		} catch (e) {
			logger.error(`Error registering a resolved service: ${e.stack}`)
		}
	}
	// Object naming rules
	get [Symbol.toStringTag]() {
		if (!this.resolved) {
			return `${this.#serviceName} | PENDING - ${this.#blocking ? '' : 'Non-'}Blocking`
		} else {
			return `${this.#serviceName} => ${this.url}`
		}
	}
}
// Setup message listener
process.on('message', wrap(Resolved.onMessage.bind(Resolved)))