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
// Winston logger configured with current environment variables
const logger = createLogger({
	level: Args.logLevel
			|| (IS_DEVELOPMENT_MODE && 'access')
			|| 'errAcc',
	levels,
	format: format.json(),
	transports: [
		// - Write all logs with importance level of `error` or less to `error.log`
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.error.log`,
			level: 'error'
		}),
		// - Write all logs with importance level of `access` or less to `combined.log`
		new transports.File({
			filename: `${PROJECT_ROOT}/var/log/${PID}.combined.log`,
			level: 'access'
		}),
	],
})
// If in development or debug mode then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest })`
if (IS_DEVELOPMENT_MODE) {
	logger.add(new transports.Console({
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
	}))
} else {
	logger.add(new transports.MongoDB({
		db: connectionString,
		options: connectionOptions,
		label: PID
	}))
}
// Make the logger as default export
export default logger