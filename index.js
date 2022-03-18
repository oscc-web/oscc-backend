import { Args, __COMMAND__ } from './lib/env.js'
import logger from './lib/logger.js'
import { setLock, getLock } from './daemon/pidLock.js'
import Process from './daemon/Process.js'
import createWatcher from './daemon/Watcher.js'
const $M = (path) => `modules/${path}`
function startServer() {
	new Process('router', { port: Args.port })
	new Process($M('mailer'))
	new Process($M('upload'))
}
/**
 * @typedef 
 */
switch (__COMMAND__) {
	case 'install':
		import('./daemon/REPL.js')
		break
	case 'connect':
		import('./daemon/REPL.js')
		break
	case 'watch':
		createWatcher()
		break
	case 'start':
		logger.info('Starting YSYX backend services')
		if (getLock()) {
			logger.error(`A server process [PID=${getLock()}] is already running`)
			logger.info('Use \'restart\' command if you wish to kill existing server')
			process.exit(1)
		}
	// eslint-disable-next-line spellcheck/spell-checker
	// eslint-disable-next-line no-fallthrough
	case 'restart':
		logger.info('Restarting YSYX backend services')
	// eslint-disable-next-line spellcheck/spell-checker
	// eslint-disable-next-line no-fallthrough
	default:
		await setLock(process.pid)
		logger.info(`YSYX backend services launched at [${Args.mode}] mode`)
		startServer()
		break
}