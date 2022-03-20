import 'colors'
import repl, { REPL_MODE_SLOPPY } from 'repl'
import Session from '../lib/session.js'
import User from '../lib/user.js'
import Group from '../lib/groups.js'
import { AppData } from '../lib/appData.js'
import { AppDataWithFs } from '../lib/appDataWithFs.js'
import { PRIV, PRIV_LUT } from '../lib/privileges.js'
import dbInit from '../utils/mongo.js'
import { hash } from '../utils/crypto.js'
import { sendMail } from '../modules/mailer/lib.js'
import { consoleTransport } from '../lib/logger.js'
import { Writable } from 'stream'
import { getLock } from './pidLock.js'
import { exec, spawn } from 'child_process'
import { PROJECT_ROOT } from '../lib/env.js'
// REPL Prompt
const prompt = ['ysyx'.yellow, '>'.dim, ''].join(' ')
let cachedStartRow = undefined
// Create REPL instance
const rp = repl.start({
	prompt,
	ignoreUndefined: true,
	useColors: true,
	preview: true,
	replMode: REPL_MODE_SLOPPY,
})
rp.on('exit', () => process.exit(0))
rp.defineCommand('help', {
	help: 'Print help message for ysyx-backend-services REPL',
	action(str) {
		this.clearBufferedCommand()
		console.log(HELP_MESSAGE.yellow)
		this.displayPrompt()
	}
})
Object
	.entries({
		Session, User, Group, AppData, AppDataWithFs, consoleTransport, PRIV, PRIV_LUT, sendMail,
		db: dbInit('user/CRUD', 'session/CRUD', 'groups/CRUD', 'appData/CRUD', 'log/CRUD'),
		pwd(str) {
			return hash(str)
		}
	})
	.forEach(([name, value]) => {
		if (typeof value === 'object') value = Object.freeze(value)
		if (typeof value === 'function' && value.length === 0)
			Object.defineProperty(rp.context, name, {
				configurable: false,
				enumerable: true,
				get: value,
			})
		else
			Object.defineProperty(rp.context, name, {
				configurable: false,
				enumerable: true,
				value
			})
	})

const HELP_MESSAGE = `
Help message for ysyx-backend-services
--------------------------------------
Keywords:
  help   	- Show this message
Objects:
  db    	- Database entry point
Available Classes:
  User   	- The core User class
  Session	- Session class
  Group  	- User Group
`.trim()
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

console._stdout = logProxy

for (const cmd of ['start', 'stop', 'restart']) {
	rp.defineCommand(cmd, {
		action(args) {
			this.clearBufferedCommand()
			const proc = spawn('node', [
				PROJECT_ROOT,
				cmd,
				args
			])
			proc.stdout.pipe(logProxy)
			this.displayPrompt()
		}
	})
}