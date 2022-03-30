import 'colors'
import 'moment-timezone'
import 'winston-mongodb'
import moment from 'moment'
import cluster from 'cluster'
import { createLogger, format, transports, addColors } from 'winston'
import Transport from 'winston-transport'
import { PID, PROJECT_ROOT, IS_DEVELOPMENT_MODE, Args, config, _ } from './env.js'
import dbInit from 'utils/mongo.js'
import { MessageHub } from 'utils/ipc.js'
// Create the process label with an conditional indicator for clustered process
const label = PID + (cluster.isWorker ? `[${process.env.CLUSTER_ID || '*'}]` : '')
// Map of logging levels, the order matters
const levelMap = [
	['error', 'red'],
	['warn', 'yellow'],
	['info', 'green'],
	['errAcc', 'underline cyan'],
	['access', 'cyan'],
	['debug', 'blue'],
	['verbose', 'gray'],
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
					level, label, duplicates, message, timestamp = new Date(), ...args
				} = info,
				ws = 6 - level.replace(/\x1b\[[0-9;]*m/g, '').match(/[a-z_-]/ig)?.length || 0,
				// w = [Math.floor(ws / 2), Math.ceil(ws / 2)].map(l => ''.padEnd(l, ' ')),
				// w = ''.padEnd(ws, ' '),
				dup = duplicates ? ` (${`×${duplicates}`.underline})`.dim : ''
			const ts = (moment(timestamp).tz('Asia/Shanghai').format('hh:mm:ss YYYY-MM-DD') + ' CST').dim
			return `${ts} [${level}] ${label}:${dup} ${message.trim()}`
		}),
	)
})
class LogHub extends MessageHub {}
class ClusterTransport extends Transport {
	log(info, callback) {
		LogHub.sendMessage(info, { $ttl: 1 })
		callback()
	}
}
class MongoTransport extends Transport {
	#collection = dbInit('log/C').log
	log(info, callback) {
		this.#collection.insert(info).then(() => callback())
	}
}
// Current logging level
const level = Args.logLevel ||
			(IS_DEVELOPMENT_MODE && 'debug') ||
			'access'
// Winston logger configured with current environment variables
const logger = createLogger({
	level,
	levels,
	format: format(({
		label = PID,
		timestamp = new Date,
		...info
	}) => ({
		label,
		timestamp,
		...info
	}))(),
	transports: cluster.isPrimary
		? [
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
			new MongoTransport
		].filter(el => !!el)
		: [new ClusterTransport],
})
// Make the logger as default export
export default logger
// Transport cluster log with debounce
class CachedLog {
	duplicates
	dupLabel
	cache
	label
	timeout
	onSubmit() { throw new Error }
	constructor({ label, timestamp, ...cache }, dupLabel, onSubmit) {
		Object.assign(this, { label, timestamp, cache, dupLabel, onSubmit })
		this.scheduleSubmit()
	}
	check({ label, timestamp, ...cache }) {
		if (_.isEqual(this.cache, cache)) {
			this.duplicates = (this.duplicates || 1) + 1
			this.label = this.dupLabel
			this.scheduleSubmit()
			return true
		}
		return false
	}
	scheduleSubmit() {
		try {
			clearTimeout(this.timeout)
		// eslint-disable-next-line no-empty
		} catch (e) {}
		this.timeout = setTimeout(() => {
			try {
				const { cache: { log, ...args }, label, duplicates } = this
				logger.log({
					...log,
					...args,
					label,
					duplicates
				})
				this.onSubmit(this)
			} catch (e) {
				// Will be caught by parent process
				console.error(e.stack)
			}
		}, 100)
	}
}

export function createCollapsedLog(dupLabel) {
	const cacheList = []
	const collapsedLogger = Object.assign(
		info => {
			if (!cacheList.filter(c => c.check(info)).reduce((a, b) => a || b, false)) {
				cacheList.push(new CachedLog(info, dupLabel, c => {
					let index
					while ((index = cacheList.indexOf(c)) >= 0)
						cacheList.splice(index, 1)
				}))
			}
		},
		Object.fromEntries(
			levelMap.map(([level]) => [
				level,
				(message, ...args) => collapsedLogger({
					level, message,
					meta: args.reduce((a, b) => Object.assign({}, a, b), undefined)
				})
			])
		))
	return collapsedLogger
}

if (cluster.isPrimary)
	LogHub.addMessageHubListener(createCollapsedLog(`${PID}[*]`))
