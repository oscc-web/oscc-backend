import { ServerResponse } from 'http'
import logger from '../lib/logger.js'
export class WebsocketResponse extends ServerResponse {
	get method() { return 'WS' }
	isWebsocket = true
	constructor(req, ws, head) {
		super(req)
		for (const prop in this) {
			if (typeof this[prop] === 'function') {
				this[prop] = (...args) => logger.warn(
					`WebsocketResponse dose not support ${prop}(${args.map(e => JSON.stringify(e)).join(', ')})`
				)
			}
		}
		Object.assign(this, { ws, head })
	}
}