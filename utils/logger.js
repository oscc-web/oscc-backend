import 'colors'
import moment from 'moment'
import 'moment-timezone'
import { createLogger, format, transports, addColors } from 'winston'
import 'winston-mongodb'
import { PROJECT_ROOT, config } from '../lib/env.js'
let levels = [
	['error', 'red'],
	['warn', 'yellow'],
	['info', 'green'],
	['errAcc', 'underline gray'],
	['access', 'gray'],
	['verbose', 'cyan'],
	['debug', 'blue'],
	['silly', 'magenta']
]
addColors(Object.fromEntries(levels))
levels = Object.fromEntries(levels.map(([lv], i) => [lv, i]))
export default function create(identity) {
	const IS_DEVELOPMENT_MODE = /^((dev(elopment)?)|debug|dbg)$/i.test(config.mode)
	let serviceName = identity.replace(/modules\//g, '').replace(/\/\\/g, '.')
	const logger = createLogger({
		level: config?.logLevel
			|| (IS_DEVELOPMENT_MODE && 'access')
			|| 'info',
		levels,
		timestamp: true,
		format: format.json(),
		transports: [
			// - Write all logs with importance level of `error` or less to `error.log`
			// - Write all logs with importance level of `info` or less to `combined.log`
			new transports.File({
				filename: `${PROJECT_ROOT}/var/log/${serviceName}.error.log`,
				level: 'error'
			}),
			new transports.File({
				filename: `${PROJECT_ROOT}/var/log/${serviceName}.combined.log`,
			}),
		],
	})
	// If in development or debug mode then log to the `console` with the format:
	// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
	if (IS_DEVELOPMENT_MODE) {
		logger.add(new transports.Console({
			format: format.combine(
				format.cli({ levels }),
				format(info => {
					console.log(`${
						(moment().tz('Asia/Shanghai').format('hh:mm:ss YYYY-MM-DD') + ' CST').dim
					} [${info.level}]${info.message}`)
				})()
			)
		}))
	}
	// Return the logger
	return logger
}
// This logger is mainly used for syntax highlighting
export const dummyLogger = createLogger()