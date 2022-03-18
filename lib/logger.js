import 'colors'
import 'moment-timezone'
import 'winston-mongodb'
import moment from 'moment'
import { createLogger, format, transports, addColors } from 'winston'
import { PID, PROJECT_ROOT, IS_DEVELOPMENT_MODE, Args, config } from './env.js'
import { connectionOptions, connectionString } from '../utils/mongo.js'
let levels = [
	['error', 'red'],
	['warn', 'yellow'],
	['info', 'green'],
	['errAcc', 'underline cyan'],
	['access', 'cyan'],
	['verbose', 'gray'],
	['debug', 'blue'],
	['silly', 'magenta']
]
addColors(Object.fromEntries(levels))
levels = Object.fromEntries(levels.map(([lv], i) => [lv, i]))
// Export cli transport for watcher process
export const consoleTransport = new transports.Console({
	format: format.combine(
		format.colorize(),
		format.align(),
		// eslint-disable-next-line spellcheck/spell-checker
		format.printf((info) => {
			const {
					level, message, ...args
				} = info,
				ws = 6 - level.replace(/\x1b\[[0-9;]*m/g, '').match(/[a-z_-]/ig)?.length || 0,
				w = [Math.floor(ws / 2), Math.ceil(ws / 2)].map(l => ''.padEnd(l, ' '))
			const ts = (moment().tz('Asia/Shanghai').format('hh:mm:ss YYYY-MM-DD') + ' CST').dim
			return `${ts} [${w[0]}${level}${w[1]}] ${PID}: ${message.trim()}${
				Object.keys(args).length ? '\n' + JSON.stringify(args, null, 2) : ''
			}`
		}),
	)
})
// Winston logger configured with current environment variables
const logger = createLogger({
	level: Args.logLevel
			|| (IS_DEVELOPMENT_MODE && 'access')
			|| 'errAcc',
	levels,
	format: format.json(),
	transports: [
		Args.transportLogToFile &&
		// - Write all logs with importance level of `error` or less to `error.log`
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.error.log`,
			level: 'error'
		}),
		Args.transportLogToFile &&
		// - Write all logs with importance level of `access` or less to `combined.log`
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.combined.log`,
			level: 'access'
		}),
		IS_DEVELOPMENT_MODE
			// If running in development mode, log will be directly printed to console
			? consoleTransport
			// Otherwise, log will be transported to MongoDB:${database}/log
			: new transports.MongoDB({
				db: connectionString,
				options: connectionOptions,
				collection: 'log',
				label: PID,
			})
	].filter(el => !!el),
})
// Make the logger as default export
export default logger