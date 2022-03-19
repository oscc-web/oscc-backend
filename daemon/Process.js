import { config, IS_DEVELOPMENT_MODE, PROJECT_ROOT, Args } from '../lib/env.js'
import { spawn } from 'child_process'
import { resolve } from 'path'
import logger from '../lib/logger.js'
export default class Process {
	#path
	#args
	/**
	 * @type {import('child_process').ChildProcessWithoutNullStreams}
	 */
	#proc
	/**
	 * @param {String} path Entry point path relative to project root
	 * @param {import('./utils/args.js').Arguments} args List of additional arguments (argv)
	 */
	constructor(path, { detached = false, ...args } = {}) {
		this.#path = path
		this.#args = Object.assign({ ...Args, port: undefined, __COMMAND__: 'run' }, args)
		Process.list.push(this)
		this.#launch(detached)
	}
	/**
	 * Timestamp indicating when last unexpected exit happens
	 */
	#lastUnexpectedExit
	/**
	 * Create a new child process and replace into #proc
	 */
	#launch(detached = false) {
		const { __COMMAND__, ...args } = this.#args
		const proc = this.#proc = spawn('node', [
			resolve(PROJECT_ROOT, this.#path),
			__COMMAND__,
			...Object.entries(args).map(([el, val]) => {
				if (el && val !== undefined)
					return `--${el.toString()}=${val.toString()}`
			}).filter(el => !!el)
		], { detached })
		//
		if (detached) {
			// eslint-disable-next-line spellcheck/spell-checker
			proc.unref()
		}
		else {
			proc.on('spawn', () => 
				logger.info(`Process ${this.#path} launched`)
			)
			proc.on('exit', this.onExit())
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
	onExit() {
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
					Process.list = Process.list.filter(p => p !== this)
				} else {
					logger.warn(`Trying to restart process ${this.#path}`)
					this.#lastUnexpectedExit = Date.now()
					this.#launch()
				}
			} else {
				logger.info(`Process ${this.#path} exited on ${signal} (${code})`)
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

	detach() {
		const proc = this.#proc
		proc.detach()
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
		})
	}
	// Static methods and processes
	/**
	 * list of currently active child processes
	 * @type {Process[]}
	 */
	static list = []
	/**
	 * Boolean flag indicating if SIG_INT has been received.
	 */
	static #SIGINT = false
	static get SIGINT() {
		return this.#SIGINT
	}
	static set SIGINT(val) {
		if (this.SIGINT && !val) throw new TypeError('SIGINT can not be turned off once triggered')
		// First SIGINT received, try to terminate all processes and exit gracefully
		logger.info('Received SIG_INT.')
		if (!this.SIGINT) {
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
		else if (val) {
			logger.warn('Force exiting.')
			process.exit(1)
		}
		// Set SIGINT according to val
		this.#SIGINT = !!val
	}
}
/**
 * Exit listener
 */
process.on('SIGINT', (() => {
	let deBounce = performance.now() + 200
	return () => {
		if (performance.now() > deBounce) {
			process.stdout.write('\n')
			Process.SIGINT = true
		}
		deBounce = performance.now() + 200
	}
})())