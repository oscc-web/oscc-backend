import { Args } from './lib/env.js'
import logger from './lib/logger.js'
import Process from './daemon/Process.js'
const $M = (path) => `modules/${path}`
// const router = spawn('node scripts/test')
// Boot-up log
logger.info(`YSYX backend services launched at [${Args.mode}] mode`)

new Process('router')
new Process($M('mailer'))