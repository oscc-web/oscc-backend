import 'colors'
import repl, { REPL_MODE_SLOPPY } from 'repl'
import Session from 'lib/session.js'
import User, { GuestUser } from 'lib/user.js'
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
import { ObjectId } from 'mongodb'
import { PROJECT_ROOT } from 'lib/env.js'
import wrap, { setFunctionName } from 'utils/wrapAsync.js'
import Process from './Process.js'
import * as daemon from '../index.js'
import stat from 'utils/Statistics.js'
import { cliCommands } from './commands.js'
// REPL Prompt
const prompt = ['ysyx'.yellow, '>'.dim, ''].join(' ')
// REPL Readonly Context
const
	db = dbInit('user/CRUD', 'session/CRUD', 'groups/CRUD', 'appData/CRUD', 'log/CRUD'),
	objects = { PRIV, PRIV_LUT, daemon, db },
	classes = { Session, User, GuestUser, Group, AppData, AppDataWithFs },
	utilities = { consoleTransport, Process, ObjectId },
	functions = { hash, wrap, setFunctionName }

const context = {
	...objects,
	...classes,
	...utilities,
	...functions,
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
	.on('reset', async ctx => {
		rp.pause()
		rp.clearBufferedCommand()
		await new Promise(r => process.stdout.cursorTo(0, 0, r))
		await new Promise(r => process.stdout.clearScreenDown(r))
		initialize(ctx)
		rp.displayPrompt()
		rp.resume()
	})
/**
 * Initialize the REPL context
 */
function initialize(ctx){
	Object
		.entries(context)
		.forEach(([name, value]) => Object.defineProperty(
			ctx,
			name,
			{
				configurable: false,
				enumerable: true,
				value,
			}
		))
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
	// eslint-disable-next-line no-empty
	if (pending?.resume) try { pending.res(false) } catch (e) {}
	// Wait for previous task to finish
	else await pending?.promise
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
		const { res } = await getConsoleLock(false)
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
			const { res, promise } = await getConsoleLock(true)
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
// Overload help command
rp.defineCommand('help', {
	action() {
		this.clearBufferedCommand()
		console.log(HELP_MESSAGE())
		this.displayPrompt()
	}
})
// Define stat command
rp.defineCommand('stat', {
	action(args) {
		this.pause()
		this.clearBufferedCommand()
		stat(args)
			.catch(console.error)
			.then(() => {
				this.displayPrompt()
				this.resume()
			})
	}
})
// Initialize server control commands
for (const cmd of ['start', 'stop', 'restart', 'run']) {
	rp.defineCommand(cmd, {
		action(args) {
			this.pause()
			this.clearBufferedCommand()
			const node_flags = []
			const user_args = args.replace(/(^|\s)[:@][\w_-]*/gi, str => {
				node_flags.push(
					str
						.trim()
						.replace(/^:/, '-')
						.replace(/^@/, '--')
				)
				return ''
			})
			// Assembly final arguments
			const $ = [
				'node', [
					...node_flags,
					PROJECT_ROOT,
					cmd,
					user_args
				]
			]
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
function lineBreak(line, ps, width = Math.min(80, process.stdout.columns)) {
	const lw = width - ps, pad = `\n${''.padEnd(ps)}`
	if (lw <= 0) return line
	if (line.includes('\n')) return line
		.split('\n')
		.map(l => lineBreak(l, ps, width))
		.join(pad)
	const lines = line.match(new RegExp(`.{1,${lw}}`, 'g'))
	return lines.join(pad)
}

function makeHelp(obj) {
	const w = Math.max(...Object.keys(obj).map(s => s.length)), j = '  '
	return Object
		.entries(obj)
		.map(([key, info]) => Array.isArray(info)
			? [key, info.join('\n')]
			: [key, info.toString()]
		)
		.map(([key, info]) => [
			'  ',
			key.padEnd(w),
			j,
			lineBreak(info, 2 + w + j.length)
		].join(''))
		.join('\n\n')
}

const HELP_MESSAGE = () => `
Help message for ysyx-backend-services
--------------------------------------
Commands:

${makeHelp(cliCommands)}


Available Classes:

  ${Object.keys(classes).join(', ')}


Available Objects:

  ${Object.keys(objects).join(', ')}


Available Utilities:

  ${Object.keys(utilities).join(', ')}


Available Functions:

  ${Object.keys(functions).map(f => `${f}()`).join(', ')}
`
