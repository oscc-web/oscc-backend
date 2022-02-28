import dbInit from '../utils/mongo.js'
import { identity } from './env.js'
export class AppData {
	#appID
	get appID() { return this.#appID }
	constructor(appID = identity) {
		if (!appID || typeof appID !== 'string') throw new Error('Failed to get application unique identifier')
		this.#appID = appID
	}
	// MongoDB Storage
	async store(content, identifier) {}
	async load(content, identifier) {}
	async update(content, identifier) {}
	async delete(content, identifier) {}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('appData/CRUD')
	}
	// Object naming rules
	get [Symbol.toStringTag]() {
		return `${this.constructor.name} <${this.appID}>`
	}
	
}

export class AppDataWithFs extends AppData {
	constructor(appID) {
		super(appID)
	}
	// File upload plugin
	async acquireFile(fileID, identifier) {}
	async loadFile(fileID, identifier) {}
	async pipeFile(fileID, identifier, pipe) {}
	async deleteFile(fileID, identifier) {}
}