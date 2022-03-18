import 'colors'
import 'moment-timezone'
import 'winston-mongodb'
import moment from 'moment'
import net from 'net'
import { createLogger, format, transports, addColors } from 'winston'
import { PID, PROJECT_ROOT, IS_DEVELOPMENT_MODE, Args, config } from './env.js'
import { connectionOptions, connectionString } from '../utils/mongo.js'
const levelMap = [
	['error', 'red'],
	['warn', 'yellow'],
	['info', 'green'],
	['errAcc', 'underline cyan'],
	['access', 'cyan'],
	['verbose', 'gray'],
	['debug', 'blue'],
	['silly', 'magenta']
]
addColors(Object.fromEntries(levelMap))
export const levels = Object.fromEntries(levelMap.map(([lv], i) => [lv, i]))
// Export cli transport for watcher process
export const consoleTransport = new transports.Console({
	format: format.combine(
		format.colorize(),
		format.align(),
		// eslint-disable-next-line spellcheck/spell-checker
		format.printf((info) => {
			const {
					level, label = PID, message, timestamp = new Date(), ...args
				} = info,
				ws = 6 - level.replace(/\x1b\[[0-9;]*m/g, '').match(/[a-z_-]/ig)?.length || 0,
				w = [Math.floor(ws / 2), Math.ceil(ws / 2)].map(l => ''.padEnd(l, ' '))
			const ts = (moment(timestamp).tz('Asia/Shanghai').format('hh:mm:ss YYYY-MM-DD') + ' CST').dim
			return `${ts} [${w[0]}${level}${w[1]}] ${label}: ${message.trim()}${
				Object.keys(args).length ? '\n' + JSON.stringify(args, null, 2) : ''
			}`
		}),
	)
})
// Current logging level
const level = Args.logLevel
			|| (IS_DEVELOPMENT_MODE && 'debug')
			|| 'access'
// Winston logger configured with current environment variables
const logger = createLogger({
	level,
	levels,
	format: format.json(),
	transports: [
		// Write all logs with importance level of `error` or less to `error.log`
		Args.logToFile &&
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.error.log`,
			level: 'error'
		}),
		// Write all logs with importance level of `access` or less to `combined.log`
		Args.logToFile &&
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.combined.log`,
			level: 'access'
		}),
		// Directly print log to console
		Args.logToConsole &&
		consoleTransport,
		// Insert log to MongoDB:${database}/log
		!Args.logToConsole &&
		new transports.MongoDB({
			db: connectionString,
			options: connectionOptions,
			collection: 'log',
			label: PID,
			level
		})
	].filter(el => !!el),
})
// Make the logger as default export
export default logger