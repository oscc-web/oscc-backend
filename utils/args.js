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
 * @property {Number} [cluster=0]
 * Number of cluster workers for current module, set to 0 if cluster is not needed
 * @property {Boolean} [logToFile=false]
 * Controls whether logger will transport to file located in var/log
 * @property {Boolean} [logToConsole=false]
 * Controls whether logger will transport to file located in var/log
 * @property {Boolean} [useDevProxy=false]
 * Controls whether front-end dev proxies are honored
 */

/**
 * @type {Arguments}
 */
const args = {
		__COMMAND__: 'start',
		mode: 'PRODUCTION',
		logLevel: undefined,
		port: undefined,
		host: '127.0.0.1',
		logToFile: undefined,
		logToConsole: undefined,
		useDevProxy: undefined,
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
		useDevProxy(arg = true) {
			arg = JSON.parse(arg)
			return { useDevProxy: arg }
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
	},
	toggles = {
		h: () => flags.help(),
		l: () => flags.logToConsole(),
		L: () => flags.logToFile(),
		d: () => [flags.mode('DEVELOPMENT'), flags.useDevProxy(), flags.logLevel('debug')],
		v: () => flags.logLevel('verbose'),
		D: () => [flags.mode('DEVELOPMENT'), flags.logLevel('debug')],
		p: () => [flags.useDevProxy()],
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
	return Object.assign({}, ...argv.map(arg => {
		if (/^--/.test(arg)) {
			// Treat argument as flag
			let [flag, value] = arg.replace(/^--/gi, '').split('=', 2)
			flag = flag.replace(/-[a-z]/gi, ([_, c]) => c.toUpperCase())
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
			const command = arg.toLocaleLowerCase()
			if (command in commands)
				return commands[command](), { __COMMAND__: command }
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
	start    Start the server in specified mode.
	connect  Connect to command-line interface of server utilities.
	watch    Watch database log updates.
	restart  Restart running server, start a new server if none is running.
	install  Install dependencies and runtime environment on current system.

parameters:
	-l, -L   Log transport triggers. -l enables console transport, -L enables file transport
`.trim()