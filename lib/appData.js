import dbInit from '../utils/mongo.js'
import { identity, logger, PROJECT_ROOT, TODO } from './env.js'
import fs from 'fs-extra'
export class AppData {
	#appID
	get appID() { return this.#appID }
	constructor(appID = identity) {
		if (!appID || typeof appID !== 'string') throw new Error('Failed to get application unique identifier')
		this.#appID = appID
	}
	// MongoDB Storage
	/**
	 * Store content into appData, content can be located by identifier
	 * @param {Object | String | Number | Boolean} content 
	 * @param {Object | String | Number | Boolean} identifier 
	 * @param {{
	 * 	replace: Boolean,
	 * 	push: Boolean,
	 * }} args 
	 * @returns {Promise<import('mongodb').InsertOneResult | Promise<import('mongodb').UpdateResult>}
	 */
	async store(content, identifier, args = { replace: false, push: false }) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier, appID: this.appID }).toArray()
		let result = null
		if (query.length === 0 || args.replace || args.push) {
			// If replace is enabled and there exists matching entry, drop existing entries.
			if (query.length && args.replace) {
				await this.delete(identifier)
			}
			// Insert new AppData
			result = await AppData.db.appData.insert({ content, identifier, appID: this.appID })
		} else {
			throw new Error(`Store appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		}
		return result
	}
	/**
	 * Load content from appData, content can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @param {Boolean} duplicate
	 * @returns {Promise<Object | Object[]>}
	 */
	async load(identifier, duplicate = false) {
		// let arr = identifierArr(identifier)
		let query = (await AppData.db.appData
			.find({ identifier, appID: this.appID }, { content: true })
			.toArray())
			.map(({ content } = {}) => content)
		return duplicate
			? query
			: query[0]
	}
	/**
	 * Upload content into appData, content can be located by identifier
	 * @param {Object | String | Number | Boolean} content 
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async update(content, identifier) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier, appID: this.appID }).toArray()
		let updateResult = null
		if (query.length !== 1) {
			throw new Error(`Update appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		} else {
			let query = await this.load(identifier)
			Object.entries(content).forEach(([key, value]) => {
				query[key] = value
			})
			let result = await AppData.db.appData.update({ identifier, appID: this.appID }, { $set: { content } })
			updateResult = result
		}
		return updateResult
	}
	/**
	 * Delete content from appData specified by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 */
	async delete(identifier) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier, appID: this.appID }).toArray()
		let deleteResult = null
		if (query.length !== 1) {
			throw new Error(`Delete appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		} else {
			let result = await AppData.db.appData.delete({ identifier, appID: this.appID })
			deleteResult = result
		}
		return deleteResult
	}
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
	/**
	 * Acquire file in appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async acquireFile(identifier) {
		let content = await this.load(identifier)
		if (!content || !content.temp) {
			return null
		}
		content.temp = false
		let acquired = await this.update(content, identifier)
		if (acquired) return content
		return null
	}
	/**
	 * Load file from appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<Buffer>}
	 */
	async loadFile(identifier) {
		let content = await this.load(identifier)
		if (!content || content.temp) {
			return null
		}
		return fs.readFileSync(`${PROJECT_ROOT}/tmp/${content.fileID}`)
	}
	async pipeFile(identifier, pipe) { }
	/**
	 * Change the file type to temp in appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async deleteFile(identifier) {
		let content = await this.load(identifier)
		if (!content || content.temp) {
			return false
		}
		content.temp = true
		let result = await this.update({ content }, identifier)
		return result
	}
}