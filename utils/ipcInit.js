import logger from '../lib/logger.js'
import wrap from './wrapAsync.js'
/**
 * Initialize basic IPC protocol for given process
 * @this {import('child_process').ChildProcess | import('cluster').Worker}
 * process instance
 * @param {string} identifier
 * Unique id string which can be matched by $target
 * @param {GeneratorFunction | Iterable | Iterator} siblings
 * Generator function that lists all currently alive sibling processes
 * The generator should return a key-value pair like ['$id', proc]
 * @returns {import('child_process').ChildProcess}
 */
export default function initIPC(identifier, siblings) {
	return this.on('message', wrap(message => {
		logger.debug(`IPC Call sent from ${identifier}: ${JSON.stringify(message)}`)
		const { $target, ...args } = message
		// Forward to child processes
		const iterator = siblings[Symbol.iterator] || siblings()
		for (const [processID, process] of iterator) {
			logger.verbose(`Iterating ${process.pid} ${processID} against ${this.pid} ${identifier}`)
			// Exclude the sender from forward targets
			if (process === this) continue
			// Check if message is designated for a certain child
			if ($target && $target !== processID) continue
			// Forward the message
			try {
				logger.debug(`Forwarding IPC Call ${identifier} => ${processID}`)
				process.send(args)
			} catch (e) {
				logger.error(`Error forwarding IPC message to child process <${process.path}>: ${e.stack}`)
			}
		}
		// Check if there is a parent process
		if (process.send) {
			// Try forward the message to the upstream
			try {
				// $target should be preserved when forwarding to upstream
				process.send(message)
			} catch (e) {
				logger.error(`Error forwarding IPC message to upstream process: ${e.stack}`)
			}
		}
	}, `ipcForwarder[${identifier}]`))
}