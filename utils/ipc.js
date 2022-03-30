import EventEmitter from 'events'
import CustomObject from './customObject.js'
import wrap from './wrapAsync.js'
const HUB = new EventEmitter
// Delayed creation of logger to resolve circular import
let _logger_ = new Promise(res => {
	process.nextTick(() =>
		import('lib/logger.js')
			.then(({ createCollapsedLog }) =>
				res(_logger_ = createCollapsedLog())
			)
	)
})
// Reduce IPC workload
let lastCall
/**
 * Initialize basic IPC protocol for given process
 * @param {import('child_process').ChildProcess | import('cluster').Worker} proc
 * process instance
 * @param {string} identifier
 * Unique id string which can be matched by $target
 * @param {GeneratorFunction | Iterable | Iterator} siblings
 * Generator function that lists all currently alive sibling processes
 * The generator should return a key-value pair like ['$id', proc]
 * @returns {import('child_process').ChildProcess}
 */
export default function forwardIPC(proc, identifier, siblings) {
	return proc.on('message', wrap(message => {
		_logger_.verbose(`IPC Call sent from ${identifier}: ${JSON.stringify(message)}`)
		// Destructure message for analysis
		const { $target, $ttl, $force, $, ...args } = message
		// Remove duplicate calls
		if (lastCall === JSON.stringify(args) && !$force) return
		// Trigger MessageHub event on current process
		if ($) HUB.emit($, args)
		// Forward to sibling and parent processes
		// Check for ttl
		if ($ttl === 1 && !$force)
			return _logger_.debug(`IPC Call from ${identifier} terminated at end of ttl`)
		// Forward to child processes
		/**
		 * @type {[String, process][]}
		 */
		const iterator = siblings && siblings[Symbol.iterator] || siblings()
		if (iterator)
			for (const [processID, process] of iterator) {
				_logger_.verbose(`Iterating ${process.pid} ${processID} against ${proc.pid} ${identifier}`)
				// Exclude the sender from forward targets
				if (process === proc) continue
				// Check if message is designated for a certain child
				if ($target && $target !== processID) continue
				// Forward the message
				try {
					_logger_.verbose(`Forwarding IPC Call ${identifier} => ${processID}`)
					process.send(
						{ $, $force, $ttl: $ttl && $ttl - 1, ...args },
						undefined, undefined,
						e => { if (e) console.error(e?.stack) }
					)
				} catch (e) {
					_logger_.error(`Error forwarding IPC message to child process <${process.path}>: ${e.stack}`)
				}
			}
		// Check if there is a parent process (that is different from proc)
		if (process.send && process !== proc) {
			// Try forward the message to the upstream
			try {
				// $target should be preserved when forwarding to upstream
				process.send(
					{ $, $force, $ttl: $ttl && $ttl - 1, $target, ...args },
					undefined, undefined,
					e => { if (e) console.error(e?.stack) }
				)
			} catch (e) {
				_logger_.error(`Error forwarding IPC message to upstream process: ${e.stack}`)
			}
		}
	}, `ipcForwarder[${identifier}]`))
}
process.on('message', wrap(({ $, ...message }) => {
	if ($) HUB.emit($, message)
}))
/**
 * This class is never intended to be directly instantiated
 */
export class MessageHub extends CustomObject {
	constructor() {
		super()
		// Add default listener for message targeted for the class
		this.constructor.addMessageHubListener(this.onMessage.bind(this))
		// get [Symbol.toStringTag]() may access child class's private variables,
		// which is not yet initialized at this moment
		setImmediate(() => _logger_.debug(`${this} setup to track ${this.constructor.name} at MessageHub`))
	}
	// Send message to specified node(s) in the process tree (excluding the sender)
	sendMessage(...args) { return this.constructor.sendMessage(...args) }
	/**
	 * The default message interceptor, should be re-implemented in child classes
	 * @param {Object} message 
	 */
	onMessage(message) {
		_logger_.warn(`Got message for ${this.constructor.name} without a handler: ${JSON.stringify(message)}`)
	}
	/**
	 * Send message to specified node(s) in the process tree (excluding the sender)
	 * @param {Object} message
	 * A serializable object containing message to send
	 * @param {String} $target
	 * The targeted process's PID, send to all processes if not specified
	 */
	static sendMessage(message, { $target, $ttl, $force } = {}) {
		if (process.send) {
			try {
				process.send(
					{ ...message, $target, $ttl, $force, $: this.name },
					undefined, undefined,
					e => { if (e) console.error(e?.stack) }
				)
			} catch (e) {
				_logger_.error(e.stack)
			}
		} else {
			_logger_.warn(`Process have no send() method: ${JSON.stringify(message)}`)
		}
	}
	static addMessageHubListener(fn, serviceName = this.name) {
		this.on(serviceName, wrap(fn))
	}
	// Deep forward of HUB event listeners
	static addListener = HUB.addListener.bind(HUB)
	static on = HUB.on.bind(HUB)
	static once = HUB.once.bind(HUB)
	static removeListener = HUB.removeListener.bind(HUB)
	static off = HUB.off.bind(HUB)
	static removeAllListeners = HUB.removeAllListeners.bind(HUB)
	static setMaxListeners = HUB.setMaxListeners.bind(HUB)
	static getMaxListeners = HUB.getMaxListeners.bind(HUB)
	static listeners = HUB.listeners.bind(HUB)
	static rawListeners = HUB.rawListeners.bind(HUB)
	static emit = HUB.emit.bind(HUB)
	static listenerCount = HUB.listenerCount.bind(HUB)
	static prependListener = HUB.prependListener.bind(HUB)
	static prependOnceListener = HUB.prependOnceListener.bind(HUB)
	static eventNames = HUB.eventNames.bind(HUB)
	// Fallback toStringTag
	get [Symbol.toStringTag]() {
		return '*'
	}
}

import lodash from 'lodash'
const { merge } = lodash
import Tree from './tree.js'
export class ProcessTree extends MessageHub {
	treeSegment = {}
	#PID
	constructor(PID) {
		super()
		this.#PID = PID
		this.sendRelay()
	}
	onMessage(treeSegment) {
		this.treeSegment = merge(this.treeSegment, treeSegment)
		this.sendRelay(true)
	}
	sendRelay(resetTimeout = false) {
		if (process.send)
			this.sendMessage({ [this.#PID]: this.treeSegment }, { $ttl: 1 })
		if (resetTimeout || this.timeout) {
			try {
				this.timeout && clearTimeout(this.timeout)
			// eslint-disable-next-line no-empty
			} catch (e) {}
			this.timeout = setTimeout(() => {
				delete this.timeout
				this.emit('ready', { [this.#PID]: this.treeSegment })
			}, 1000)
		}
	}
}
if (process?.env?.NODE_ENV === 'development') {
	// Child process logic
	_logger_.then(async logger => {
		const { PID } = await import('lib/env.js')
		const pt = new ProcessTree(PID)
		pt.sendRelay()
		if (!process.send) {
			pt.on(
				'ready',
				data => logger.debug(
					`Process tree${new Tree(data)}`
				)
			)
		}
	})
}
