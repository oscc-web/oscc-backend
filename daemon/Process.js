import { config, IS_DEVELOPMENT_MODE, PROJECT_ROOT, Args } from 'lib/env.js'
import { spawn } from 'child_process'
import { resolve } from 'path'
import logger from 'lib/logger.js'
import forwardIPC from 'utils/ipc.js'
import CustomObject from 'utils/customObject.js'
export default class Process extends CustomObject {
	// Path to this process's entry point
	#path
	get path() { return this.#path }
	// Command line arguments sent to this process
	#args
	/**
	 * @type {import('child_process').ChildProcessWithoutNullStreams}
	 */
	#proc
	get proc() { return this.#proc }
	/**
	 * @typedef {import('utils/args.js').Arguments} ProcessAdditionalArguments
	 * @property {Boolean} [detached]
	 * Indicates whether the process will be detached from current process.
	 * This is designed to be used along with 'start', 'restart' or 'stop'
	 * @property {Object} [env]
	 * Additional environment variables, can be accessed as process.env in child process
	 */
	/**
	 * @param {String} path Entry point path relative to project root
	 * @param {ProcessAdditionalArguments} [_args] List of additional arguments (argv)
	 */
	constructor(path, _args = {}) {
		super()
		const { detached, PID, env, ...args } = _args
		this.#path = path
		this.#args = Object.assign({ ...Args, port: undefined, __COMMAND__: 'run' }, args)
		Process.push(this)
		this.#launch({ PID, ...env }, detached)
	}
	/**
	 * Timestamp indicating when last unexpected exit happens
	 * @type {Number | undefined}
	 */
	#lastUnexpectedExit
	/**
	 * Create a new child process and replace into #proc
	 */
	#launch(env, detached = false) {
		const { __COMMAND__, ...args } = this.#args
		const proc = this.#proc = spawn('node', [
			resolve(PROJECT_ROOT, this.#path),
			__COMMAND__,
			...Object.entries(args).map(([el, val]) => {
				if (el && val !== undefined)
					return `--${el.toString()}=${val.toString()}`
			}).filter(el => !!el)
		], {
			detached,
			env: env ? { ...process.env, ...env } : undefined,
			stdio: detached ? 'ignore' : ['pipe', 'pipe', 'pipe', 'ipc']
		})
		// Unreference the child process if detach is set to true
		if (detached) {
			logger.debug(`Fully detached from ${proc.pid} (${this.#path})`)
			// eslint-disable-next-line spellcheck/spell-checker
			proc.unref()
		} else {
			forwardIPC(proc, this.path, Process)
				.on('spawn', () => logger.info(`Process ${this.#path} launched`))
				.on('exit', this.onExit(env))
			// eslint-disable-next-line spellcheck/spell-checker
			// Stream stdout and stderr to shared output (only in dev mode)
			if (Args.logToConsole)
				this.stream().transportError()
			else
				this.transportError()
		}
	}
	/**
	 * Chile process exit handler
	 * @returns {(code : Number | undefined, signal: NodeJS.Signals) => Any}
	 */
	onExit(env) {
		return (code, signal) => {
			if (!Process.SIGINT) {
				const lastUnexpectedExit = this.#lastUnexpectedExit, coolDown = config.processRestartCoolDownPeriodMs || 60_000
				// Treat as an accidental exit
				// Log the incident
				logger.warn(`Process ${this.#path} unexpectedly exited on ${signal} (${code})`)
				// Check if the process exits too frequently
				if (lastUnexpectedExit && lastUnexpectedExit + coolDown > Date.now()){
					logger.error(`Process ${this.#path} frequently exits, terminating this process.`)
					// Remove process from list and never try to recover
					Process.remove(this, 1)
				} else {
					logger.warn(`Trying to restart process ${this.#path}`)
					this.#lastUnexpectedExit = Date.now()
					this.#launch(env)
				}
			} else {
				logger.info(`Process ${this.#path} exited on ${signal} (${code})`)
				// Remove process from list and never try to recover
				Process.remove(this)
			}
		}
	}
	/**
	 * Captures all child-processes' output and print to console
	 * @returns {Process}
	 */
	stream() {
		const { stdout } = this.#proc
		stdout.on('data', (chunk) => process.stdout.write(chunk.toString()))
		return this
	}
	/**
	 * Captures all child-processes' standard-error and transport to logger
	 * @returns {Process}
	 */
	transportError() {
		const { stderr } = this.#proc
		stderr.on(
			'data',
			(chunk) => logger.error(`Uncaught error from ${this.#path}: ${chunk.toString().trim()}`)
		)
		return this
	}
	/**
	 * Kill this process using given signal
	 * @param {NodeJS.Signals} signal
	 * @returns {Promise<Number>} exit code
	 */
	async kill(signal = 'SIGINT') {
		return await new Promise((res, rej) => {
			this.#proc.on('exit', res)
			this.#proc.on('error', rej)
			this.#proc.kill(signal)
			logger.debug(`SIGINT sent to pid ${this.#proc.pid}`)
		})
	}
	// Static methods and processes
	/**
	 * list of currently active child processes
	 * @type {Process[]}
	 */
	static #list = []
	static get list() { return this.#list }
	static push(proc) { this.#list.push(proc) }
	static remove(proc, code = 0) {
		let i
		while ((i = this.list.indexOf(proc)) >= 0) this.list.splice(i, 1)
		if (!this.list.length) process.exit(code)
	}
	/**
	 * Boolean flag indicating if SIG_INT has been received.
	 */
	static #SIGINT = false
	static #debounce = performance.now() + 200
	static SIGINT() {
		// Check if SIGINT is triggered too frequently
		if (performance.now() < this.#debounce) return
		this.#debounce = performance.now() + 200
		process.stdout.write('\n')
		// Log the signal
		logger.info('Received SIG_INT.')
		// First SIGINT received, try to terminate all processes and exit gracefully
		if (!this.#SIGINT) {
			logger.info('Gracefully exiting, press CTRL-C again to exit immediately.')
			Promise
				.all(this.list.map(proc => proc.kill('SIGINT')))
				.then(results => {
					logger.info('All processes gracefully exited, shutting down.')
					process.exit(results.reduce((a, b) => a || b, 0))
				})
				.catch(e => {
					logger.error(`Error during graceful exit: ${e.message}`)
				})
		}
		// Second SIGINT received, exit anyway
		else {
			logger.warn('Force exiting.')
			process.exit(1)
		}
		// Set SIGINT according to val
		this.#SIGINT = true
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return `${this.proc.pid} ${this.path}` }
	// Iterator that returns [...['$id', 'proc']]
	static get [Symbol.iterator]() {
		return (function* () {
			for (const { path, proc } of this.#list) {
				logger.silly(`YIELD ${proc.constructor.name} ${path}`)
				yield [path, proc]
			}
			return { done: true }
		}).bind(this)()
	}
}
/**
 * Exit listener
 */
process.on('SIGINT', Process.SIGINT.bind(Process))
