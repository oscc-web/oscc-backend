import 'colors'
import repl, { REPL_MODE_SLOPPY } from 'repl'
import Session from 'lib/session.js'
import User from 'lib/user.js'
import Group from 'lib/groups.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { PRIV, PRIV_LUT } from 'lib/privileges.js'
import dbInit from 'utils/mongo.js'
import { hash } from 'utils/crypto.js'
// import { sendMail } from '../modules/mailer/lib.js'
import { consoleTransport } from 'lib/logger.js'
import { Writable } from 'stream'
import { spawn } from 'child_process'
import { PROJECT_ROOT } from 'lib/env.js'
import wrap, { setFunctionName } from 'utils/wrapAsync.js'
import Process from './Process.js'
import * as daemon from '../index.js'
// REPL Prompt
const prompt = ['ysyx'.yellow, '>'.dim, ''].join(' ')
// REPL Readonly Context
const context = {
	PRIV, PRIV_LUT, daemon,
	Session, User, Group, AppData, AppDataWithFs, consoleTransport, Process,
	db: dbInit('user/CRUD', 'session/CRUD', 'groups/CRUD', 'appData/CRUD', 'log/CRUD'),
	hash, wrap, setFunctionName
}
// Create REPL instance
const rp = repl
	.start({
		prompt,
		ignoreUndefined: true,
		useColors: true,
		preview: true,
		replMode: REPL_MODE_SLOPPY,
	})
	.on('exit', () => process.exit(0))
	.on('reset', async (ctx) => {
		rp.pause()
		rp.clearBufferedCommand()
		await new Promise(r => process.stdout.cursorTo(0, 0, r))
		await new Promise(r => process.stdout.clearScreenDown(r))
		initialize(ctx)
		rp.displayPrompt()
		rp.resume()
	})
// Overload help command
rp.defineCommand('help', {
	action() {
		this.clearBufferedCommand()
		console.log(HELP_MESSAGE.yellow)
		this.displayPrompt()
	}
})
/**
 * Initialize the REPL context
 */
function initialize(ctx){
	Object
		.entries(context)
		.forEach(([name, value]) => {
			// if (typeof value === 'object') value = Object.freeze(value)
			if (typeof value === 'function' && value.length)
				Object.defineProperty(ctx, name, {
					configurable: false,
					enumerable: true,
					value
				})
			else if (typeof value === 'function')
				Object.defineProperty(ctx, name, {
					configurable: false,
					enumerable: true,
					get: () => (value.bind(rp)(), undefined),
				})
			else
				Object.defineProperty(ctx, name, {
					configurable: false,
					enumerable: true,
					value,
				})
		})
}
initialize(rp.context)
// Resume timer
/**
 * @typedef {{
 * res: () => Any,
 * promise: Promise,
 * resume: Boolean
 * }} PendingState
 * @type {PendingState}
 */
let pending = undefined
/**
 * @param {Boolean} resume 
 * @returns {PendingState}
 */
async function getConsoleLock(resume = false) {
	// Take over write privilege if trying to resume
	if (pending?.resume)
		// eslint-disable-next-line no-empty
		try { pending.res(false) } catch (e) {}
	else
		// Wait for previous task to finish
		await pending?.promise
	// Create new pending task
	let res, promise = new Promise(r => res = r)
	return pending = { res, promise, resume }
}
// Take over console's std-out
const logProxy = new class LogProxy extends Writable {
	/**
	 * @param {Buffer | String} chunk 
	 * @param  {...any} args 
	 */
	async write(chunk, ...args) {
		const { stdout } = process
		let { res } = await getConsoleLock(false)
		// Pause REPL
		rp.pause()
		// // Move cursor to the start of current REPL code block
		await new Promise(r => stdout.cursorTo(0, r))
		// // Clear content of current block
		await new Promise(r => stdout.clearScreenDown(r))
		// Prepare string chunk
		chunk = chunk.toString() // .replace(/\n?$/g, '\n')
		// cachedStartRow += (chunk.match(/\n/gm) || []).length + 1
		// Print AXIS
		// await new Promise(r => stdout.write(`${cachedStartRow}`.underline, r))
		// Print log(s)
		await new Promise(r => stdout.write(chunk, r))
		// Release write lock
		// eslint-disable-next-line no-empty
		try { res(true) } catch (e) {}
		// Delayed resolution for resumption
		if (chunk.endsWith('\n')) {
			let { res, promise } = await getConsoleLock(true)
			// Only resume REPL execution upon creation of new line
			promise.then(resume => {
				// Resume REPL execution
				if (resume) rp.displayPrompt(true)
			})
			setTimeout(() => {
				// eslint-disable-next-line no-empty
				try { res(true) } catch (e) {}
			}, 10)
		}
	}
}
// Redirect console.log to logProxy
console._stdout = logProxy
// Initialize server control commands
for (const cmd of ['start', 'stop', 'restart', 'run']) {
	rp.defineCommand(cmd, {
		action(args) {
			this.pause()
			this.clearBufferedCommand()
			const node_flags = []
			const user_args = args.replace(/(^|\s)[:@][\w_-]*/gi, (str) => {
				node_flags.push(
					str
						.trim()
						.replace(/^:/, '-')
						.replace(/^@/, '--')
				)
				return ''
			})
			// Assembly final arguments
			const $ = ['node', [
				...node_flags,
				PROJECT_ROOT,
				cmd,
				user_args
			]]
			// Log the actual command used to spawn the process
			console.log($.flat(Infinity).join(' '))
			// Spawn the process
			const proc = spawn(...$, { stdio: ['ignore', 'pipe', 'pipe'] })
			proc.stdout.on('data', logProxy.write.bind(logProxy))
			proc.stderr.on('data', logProxy.write.bind(logProxy))
			const on_sig_int = () => {
				console.log(`SIGINT => ${cmd}`)
				proc.kill('SIGINT')
			}
			proc.on('exit', () => {
				proc.stdout.pause()
				proc.stderr.pause()
				rp.off('SIGINT', on_sig_int)
				// Resume repl
				this.displayPrompt()
				this.resume()
			})
			rp.on('SIGINT', on_sig_int)
		}
	})
}
// Help message for repl
const HELP_MESSAGE = `
Help message for ysyx-backend-services
--------------------------------------
Commands:
    .help     - Show this message
    .start    - Show this message
    .restart  - Show this message
    .stop     - Show this message

Classes:
    User, Session, Group, AppData[WithFs],

Objects:
    db        - Database entry point
	PRIV      - List of privileges as Enum<Number>
	PRIV_LUT  - List of privileges as Enum<String>


Functions:
   pwd()      - Generate sha256 hashed password
`
