import { Args, __action__ } from './lib/env.js'
import logger from './lib/logger.js'
import Process from './daemon/Process.js'
const $M = (path) => `modules/${path}`
switch (__action__) {
	case 'connect':
		import('./daemon/REPL.js')
		break
	case 'start':
	default:
		logger.info(`YSYX backend services launched at [${Args.mode}] mode`)
		new Process('router')
		new Process($M('mailer'))
		new Process($M('upload'))
		break
}