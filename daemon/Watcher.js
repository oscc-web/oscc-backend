import { createLogger, format } from 'winston'
import { Args } from 'lib/env.js'
import { consoleTransport, levels } from 'lib/logger.js'
import dbInit from 'utils/mongo.js'
const logger = createLogger({
	level: Args.logLevel || 'verbose',
	levels,
	format: format.json(),
	transports: consoleTransport
})
export default async function watchLog(
	collectionName = 'log',
	onChange = (...args) => console.log(args)
) {
	/**
	 * @type {import('utils/mongo.js').MongoCollection}
	 */
	const log = dbInit(`${collectionName}/R`)[collectionName]
	let d = new Date()
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const result = await (await log.find({ timestamp: { $gt: d } }, { projection: { _id: 0, meta: 0 } }))
			.sort({ timestamp: -1 })
			.toArray()
		if (result.length) {
			d = result[0].timestamp
			result
				.slice()
				.reverse()
				.forEach(l => logger.log(l))
		} else {
			await new Promise(res => setTimeout(res, 100))
		}
	}
}
