/**
 * @typedef {Object} Arguments
 * Action of current run.
 * @property {commands} __COMMAND__
 * Arguments from command-line or parent-process.
 * @property {'PRODUCTION' | 'DEVELOPMENT'} mode
 * The running mode of current module.
 * @property {'verbose' | 'debug' | 'access' | 'errAcc' | 'info' | 'warn' | 'error'} logLevel
 * The log level of current module.
 * @property {Number} port
 * The port number to which current listens
 * @property {'127.0.0.1' | '0.0.0.0'} [host='127.0.0.1']
 * The incoming host the server listens to, defaults to local host
 * @property {Number} [cluster=undefined]
 * Number of cluster workers for current module, set to 0 if cluster is not needed
 * @property {Boolean} [logToFile=false]
 * Controls whether logger will transport to file located in var/log
 * @property {Boolean} [logToConsole=false]
 * Controls whether logger will transport to file located in var/log
 * @property {Boolean} [useDevProxy=false]
 * Controls whether front-end dev proxies are honored
 * @property {Number} [stackTraceLimit=undefined]
 * Sets the trace limit of error stack
 */

import { exec } from 'child_process'

/**
 * @type {Arguments}
 */
const args = {
		__COMMAND__: 'start',
		mode: process.env.NODE_ENV || 'PRODUCTION',
		logLevel: undefined,
		port: undefined,
		host: '127.0.0.1',
		cluster: undefined,
		logToFile: undefined,
		logToConsole: undefined,
		useDevProxy: undefined,
		stackTraceLimit: undefined,
	},
	flags = {
		help() {
			console.log(HELP_MESSAGE)
			process.exit(0)
		},
		mode(mode) {
			const is_production_mode = !/^dev/i.test(mode)
			process.env.NODE_ENV = is_production_mode ? 'production' : 'development'
			return { mode: process.env.NODE_ENV.toUpperCase() }
		},
		useDevProxy(arg = true) {
			arg = JSON.parse(arg)
			return { useDevProxy: arg }
		},
		host(host) {
			return { host }
		},
		port(port) {
			port = parseInt(port)
			if (port) return { port }
			else throw new TypeError(`Bad port number: ${port}`)
		},
		cluster(arg = 1) {
			arg = parseInt(arg)
			return { cluster: arg }
		},
		logLevel(logLevel) {
			return { logLevel }
		},
		logToFile(arg = true) {
			arg = JSON.parse(arg)
			return { logToFile: arg }
		},
		logToConsole(arg = true) {
			arg = JSON.parse(arg)
			return { logToConsole: arg }
		},
		stackTraceLimit(arg) {
			arg = parseInt(arg) || undefined
			if (arg) Error.stackTraceLimit = arg
			return { stackTraceLimit: arg }
		},
		async kill(arg = 'ysyx\\.(local|org|dev|cc|test)') {
			const cmd = `kill $(ps aux | egrep -i "${arg.toUpperCase()}" | grep -v egrep | awk "{print $2}")`
			console.log(cmd)
			exec(cmd)
			await new Promise(r => { /* Console.log(i + 1); */ setTimeout(r, 1000) })
			return {}
		}
	},
	toggles = {
		h: flags.help,
		l: flags.logToConsole,
		L: flags.logToFile,
		d: () => [flags.mode('DEVELOPMENT'), flags.logLevel('debug')],
		v: () => flags.logLevel('verbose'),
		D: () => [flags.mode('DEVELOPMENT'), flags.useDevProxy(), flags.logLevel('debug')],
		p: flags.useDevProxy,
		k: flags.kill
	},
	commands = {
		// Server control
		/**
		 * Start the server and stay on front
		 */
		run() {
			return 'Start the server and stay on front'
		},
		/**
		 * Start the server, exits if there is already a server running
		 */
		start() {
			flags.logToConsole()
			return 'Start the server, exits if there is already a server running'
		},
		/**
		 * Restart the server, kills all existing servers
		 */
		restart() {
			flags.logToConsole()
			return 'Restart the server, kills all existing servers'
		},
		/**
		 * Stop any running server process
		 */
		stop() {
			flags.logToConsole()
			return 'Stop any running server process'
		},
		/**
		 * Launch in development mode
		 */
		dev() {
			flags.logToConsole()
			flags.mode('DEVELOPMENT')
			flags.logLevel('debug')
			flags.useDevProxy()
			return 'Launch in development mode'
		},
		// Utility
		/**
		 * Install commands and check the existence of config.js[on]
		 */
		install() {
			flags.logToConsole()
			return 'Install commands and check the existence of config.js[on]'
		},
		/**
		 * Connect to ysyx REPL with bunch of handful tools
		 */
		connect() {
			return 'Connect to ysyx REPL with bunch of handful tools'
		},
		/**
		 * Watch new logs from mongodb log collection
		 */
		watch() {
			flags.logToConsole()
			flags.mode('DEVELOPMENT')
			flags.logLevel('verbose')
			return 'Watch new logs from mongodb log collection'
		},
	}

/**
 * @returns {Arguments}
 */
export default async function composeArgs() {
	try {
		return Object.freeze(Object.assign(
			args,
			await makeArgv()
		))
	} catch (e) {
		console.error(`${e.name}: ${e.message}`)
		process.exit(1)
	}
}

async function makeArgv() {
	const argv = process.argv
		.slice(2)
		.join(' ')
		.trim()
		.replace(/\s(?!-)/gi, '=')
		.split(' ')
		.filter(str => !!str)
	return Object.assign({}, ...await allFlatten(argv.map(arg => {
		if (/^--/.test(arg)) {
			// Treat argument as flag
			let [flag, value] = arg.replace(/^--/gi, '').split('=', 2)
			flag = flag.replace(/-[a-z]/gi, ([_, c]) => c.toUpperCase())
			if (flag in flags) return flags[flag](value)
			else {
				// Unrecognized flag
				throw new TypeError(`Unrecognized flag: --${arg}`)
			}
		} else if (/^-/.test(arg)) {
			// Treat argument as toggle
			const args = arg.match(/[a-z]/ig)
			return args.map(async toggle => {
				if (toggle in toggles) return toggles[toggle]()
				// Unrecognized toggle
				else throw new TypeError(`Unrecognized toggle: -${toggle}`)
			})
		} else {
			const command = arg.toLocaleLowerCase()
			if (command in commands) return commands[command](), { __COMMAND__: command }
			// Illegal argument
			else throw new TypeError(`Illegal argument: ${arg}`)
		}
	})))
}

async function allFlatten(arr) {
	arr = arr.flat(Infinity)
	if (arr.filter(p => p instanceof Promise).length) return await allFlatten(await Promise.all(arr))
	else return arr
}

const HELP_MESSAGE = `
YSYX Backend Services - daemon

usage: node . start [-h] [-d --mode=DEVELOPMENT] [-v --log=verbose] ...

available commands:
	start    Start the server in specified mode.
	connect  Connect to command-line interface of server utilities.
	watch    Watch database log updates.
	restart  Restart running server, start a new server if none is running.
	install  Install dependencies and runtime environment on current system.

parameters:
	-l, -L   Log transport triggers. -l enables console transport, -L enables file transport
`.trim()
