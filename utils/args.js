/**
 * @typedef {Object} Arguments
 * Action of current run.
 * @property {'start' | 'dev' | 'stop' | 'restart' | 'connect'} __action__
 * Arguments from command-line or parent-process.
 * @property {'PRODUCTION' | 'DEVELOPMENT'} mode
 * The running mode of current module.
 * @property {'verbose' | 'debug' | 'access' | 'errAcc' | 'info' | 'warn' | 'error'} logLevel
 * The log level of current module.
 * @property {Number} port
 * The port number to which current listens
 * @property {'127.0.0.1' | '0.0.0.0'} [host='127.0.0.1']
 * The incoming host the server listens to, defaults to local host
 * @property {Number} [cluster=0]
 * Number of cluster workers for current module, set to 0 if cluster is not needed
 */

/**
 * @type {Arguments}
 */
const args = {
		mode: 'PRODUCTION',
		logLevel: undefined,
		port: undefined,
		host: '127.0.0.1'
	},
	flags = {
		help() {
			console.log(HELP_MESSAGE)
			process.exit(0)
		},
		mode(mode) {
			return {
				mode: /^dev/i.test(mode) ? 'DEVELOPMENT' : 'PRODUCTION'
			}
		},
		host(host) {
			return { host }
		},
		port(port) {
			port = parseInt(port)
			if (port)
				return { port }
			else 
				throw new TypeError(`Bad port number: ${port}`)
		},
		logLevel(logLevel) {
			if (['verbose', 'debug', 'access', 'errAcc', 'info', 'warn', 'error'].indexOf(logLevel))
				return { logLevel }
			else
				throw new TypeError(`Unknown logLevel: ${logLevel}`)
		}
	},
	toggles = {
		h: () => flags.help(),
		d: () => flags.mode('DEVELOPMENT'),
		v: () => flags.logLevel('verbose'),
		D: () => [flags.mode('DEVELOPMENT'), flags.logLevel('debug')],
	}

/**
 * @returns {Arguments}
 */
export default function composeArgs() {
	try {
		return Object.freeze(Object.assign(
			args,
			makeArgv()
		))
	} catch (e) {
		console.error(`${e.name}: ${e.message}`)
		process.exit(1)
	}
}

function makeArgv() {
	const argv = process.argv
		.slice(2)
		.join(' ')
		.trim()
		.replace(/\s(?!-)/gi, '=')
		.split(' ')
		.filter(str => !!str)
	return Object.assign({}, ...['start', ...argv].map(arg => {
		if (/^--/.test(arg)) {
			// Treat argument as flag
			const [flag, value] = arg.replace(/^--/gi, '').split('=', 2)
			if (flag in flags)
				return flags[flag](value)
			else {
				// Unrecognized flag
				throw new TypeError(`Unrecognized flag: ${arg}`)
			}
		} else if (/^-/.test(arg)) {
			// Treat argument as toggle
			const args = arg.match(/[a-z]/ig)
			return args.map(toggle => {
				if (toggle in toggles)
					return toggles[toggle]()
				else 
					// Unrecognized toggle
					throw new TypeError(`Unrecognized toggle: -${toggle}`)
			})
		} else {
			if (['start', 'dev', 'stop', 'restart', 'connect'].indexOf(arg.toLocaleLowerCase()) >= 0)
				return { __action__: arg.toLocaleLowerCase() }
			else
				// Illegal argument
				throw new TypeError(`Illegal argument: ${arg}`)
		}
	}).flat(Infinity))
}

const HELP_MESSAGE = `
YSYX Backend Services - daemon

usage: node . start [-h] [-d --mode=DEVELOPMENT] [-v --log=verbose] ...

available commands:
	start	Start the server in specified mode.
	connect	Connect to command-line interface of server utilities.
	restart	Restart running server, start a new server if none is running.
	install Install dependencies and runtime environment on current system.
`.trim()