import logger from '../lib/logger.js'
import wrap, { setFunctionName } from './wrapAsync.js'
import { PID, Args, _, TODO } from '../lib/env.js'
import cluster from 'cluster'
import forwardIPC, { MessageHub } from './ipc.js'
export default class Resolved extends MessageHub {
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
	get resolved() {
		return this.#resolved
	}
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
		return setFunctionName(async () => {
			if (!this.resolved) {
				logger.warn(`Calling resolver of ${this} before service resolution.`)
				await this.#promise
			}
			return this.#dsc
		}, `${this}`)
	}
	/**
	 * @type {import('express').Handler}
	 * Dynamically resolved static file server
	 */
	get static() {
		return TODO('Create dynamically resolved static server')
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
					`Unexpected port number <${
						typeof port
					}> ${
						port
					} during resolution of ${
						this
					}, ignoring this message ${
						JSON.stringify(ipcMsg)
					}`
				)
			if (!this.resolved)
				this.#resolve(true)
			// Record current instance descriptor
			const current = this.toString()
			// Create new descriptor
			const dsc = { port, ...args }
			// Update current resolved service descriptor
			Object.assign(this.#dsc, dsc)
			// Log the update
			setImmediate(() => {
				const next = this.toString()
				if (next !== current)
					logger.info([current, next].join(' => '))
			})
		}
	}
	onMessage({ query, ...message }) {
		if (!query) {
			this.evaluate(message)
		}
	}
	/**
	 * @type {Resolved[]} List of all Resolved instances
	 */
	static #resolveList = []
	/**
	 * Register a new resolved service into the list
	 * @param {Resolved} resolved 
	 */
	static push(resolved) {
		if (!(resolved instanceof this)) throw new TypeError
		this.#resolveList.push(resolved)
		// Query for existing service with a delay of 1 second
		setTimeout(() => {
			if (!resolved.resolved)
				this.sendMessage({ query: true, service: resolved.serviceName })
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
		let resolvePort
		const announcement = {
			service: name,
			port: new Promise(
				r => resolvePort = r
			).then(port => announcement.port = port)
		}
		if (cluster.isPrimary && Args.cluster) {
			let lastUnexpectedExit = performance.now()
			const workers = [], createClusterWorker = (CLUSTER_ID) => {
				const worker = forwardIPC(
					cluster.fork({ CLUSTER_ID }),
					PID,
					// Cluster should never send a message to its siblings
					() => []
				).on('listening', ({ port }) => {
					if (announcement.port instanceof Promise) {
						resolvePort(port)
					}
				}).on('exit', (code, signal) => {
					logger[code ? 'warn' : 'info'](
						`ClusterWorker exited with code ${code}, signal ${signal}`
					)
					// Remove this dead worker
					delete workers[CLUSTER_ID]
					if (code) {
						// Try to resume
						if (performance.now() - lastUnexpectedExit < 60_000) {
							// Set restart timer for this worker
							setTimeout(() => {
								createClusterWorker(CLUSTER_ID)
							}, 60_000)
						} else {
							createClusterWorker(CLUSTER_ID)
						}
					}
					if (workers.filter(w => !!w).length === 0) process.exit(code)
				})
				return workers[CLUSTER_ID] = worker
			}
			for (const CLUSTER_ID of [...Array(Args.cluster).keys()]) {
				workers[CLUSTER_ID] = createClusterWorker(CLUSTER_ID)
			}
			logger.info(`Cluster initialized with ${Args.cluster} instances`)
			// Forward upstream IPC message to children
			forwardIPC(process, '__parent_process__', () => workers.map(worker => [PID, worker]))
			// SIGINT Interceptor
			let SIGINT
			process.on('SIGINT', () => {
				if (SIGINT) {
					logger.warn('Received SIGINT again, force exiting')
					workers.forEach(wrap(worker => {
						if (worker) worker.kill('SIGTERM')
					}))
					process.exit(1)
				} else {
					workers.forEach(wrap(worker => {
						if (worker) worker.kill('SIGINT')
					}))
				}
				SIGINT = true
			})
		} else {
			// Launch server for this service
			server = server.listen(Args.port || 0, () => {
				const port = server.address().port
				resolvePort(port)
				// Log the launched server
				logger.info(cluster.isWorker
					? `Clustered Service up and running at port ${port}`
					: `Standalone service up and running at port ${port}`
				)
			})
			process.on('SIGINT', async () => {
				logger.info(`Service (${process.pid}) stopping`)
				server.close(() => {
					logger.info(`Service (${process.pid}) stopped`)
					process.exit(0)
				})
			})
		}
		if (!cluster.isWorker) {
			await announcement.port
			// Announce the service
			this.sendMessage(announcement)
			// Listen for later initialized service query
			this.addMessageHubListener(({ query, service }) => {
				if (query && name === service)
					this.sendMessage(announcement)
			})
		}
		// Wait until a port number is added to announcement
		return announcement.port
	}
	// Object naming rules
	get [Symbol.toStringTag]() {
		if (!this.resolved) {
			return `${this.#serviceName} PENDING, ${this.#blocking ? '' : 'Non-'}Blocking`
		} else {
			return `${this.#serviceName} ${this.url}`
		}
	}
}