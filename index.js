import { config, Args, PROJECT_ROOT, TODO, __COMMAND__ } from './lib/env.js'
import { spawn } from 'child_process'
import logger from './lib/logger.js'
import { setLock, getLock } from './daemon/pidLock.js'
import Process from './daemon/Process.js'
import createWatcher from './daemon/Watcher.js'
export async function startServer() {
	await setLock(process.pid)
	const manifest = (await import('./manifest.js')).default
	logger.debug(`Manifest loaded: ${JSON.stringify(manifest)}`)
	for (const [path, params] of Object.entries(manifest)) {
		logger.debug(`Launching ${path} with ${
			Object
				.entries(params)
				.map(([x, y]) => `${x}=${y}`)
				.join(' ')
		}`)
		new Process(path, params)
	}
}
/**
 * @typedef
 */
switch (__COMMAND__) {
	case 'install':
		TODO('Installation tasks')
		break
	case 'connect':
		// Change process name for easy identification
		process.title = 'YSYX REPL'
		import('./daemon/REPL.js')
	// eslint-disable-next-line spellcheck/spell-checker
	// eslint-disable-next-line no-fallthrough
	case 'watch':
		createWatcher()
		break
	case 'stop':
		logger.info('Stopping YSYX backend services')
		await setLock()
		process.exit(0)
		break
	case 'start':
	case 'restart':
		if (__COMMAND__ == 'start' && getLock()) {
			console.error(`A server process [PID=${getLock()}] is already running`)
			console.log('Use \'restart\' command if you wish to kill existing server')
			process.exit(1)
		}
		logger.info('Restarting YSYX backend services')
		await setLock()
		new Process('.', { detached: true, logToConsole: false, port: Args.port })
		process.exit(0)
		break
	case 'run':
	case 'dev':
	default:
		logger.info(`YSYX backend services launched at [${Args.mode}] mode`)
		if (getLock()) {
			logger.error(`A server process [PID=${getLock()}] is already running`)
			logger.info('Use \'restart\' command if you wish to kill existing server')
			process.exit(1)
		}
		startServer()
		break
}
