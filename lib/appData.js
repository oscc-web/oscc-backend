import dbInit from '../utils/mongo.js'
import { PID, PROJECT_ROOT, TODO } from './env.js'
import fs from 'fs-extra'
import CustomObject from '../utils/customObject.js'
export class AppData extends CustomObject {
	#appID
	get appID() { return this.#appID }
	constructor(appID = PID) {
		super()
		if (!appID || typeof appID !== 'string') throw new Error('Failed to get application unique identifier')
		this.#appID = appID
	}
	// MongoDB Storage
	/**
	 * Store content into appData, content can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @param {Object | String | Number | Boolean} content 
	 * @param {{
	 * 	replace: Boolean,
	 * 	push: Boolean,
	 * }} args 
	 * @returns {Promise<import('mongodb').InsertOneResult | Promise<import('mongodb').UpdateResult>}
	 */
	async store(identifier, content, args = { replace: false, push: false }) {
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
	 * @param {Object | String | Number | Boolean} identifier 
	 * @param {Object | String | Number | Boolean} content 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async update(identifier, content) {
		return await AppData.db.appData.update({ identifier, appID: this.appID }, content )
	}
	/**
	 * Delete content from appData specified by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 */
	async delete(identifier) {
		return await AppData.db.appData.delete({ identifier, appID: this.appID })
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('appData/CRUD')
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return this.appID }

}
export class AppDataWithFs extends AppData {
	#appData = new AppData('upload')
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
		return await this.#appData.update(identifier, { $set:{ 'content.acquired': true } }  )
	}
	/**
	 * Load file from appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<Buffer>}
	 */
	async loadFile(identifier, duplicate = false) {
		let content = await this.#appData.load(identifier, duplicate)
		if (Array.isArray(content)) {
			content.filter(fileInfo => fileInfo.acquired)
		} else {
			if (!content.acquired) content = null 
		}
		return content
	}
	async pipeFile(identifier, pipe) { }
	/**
	 * Change the file type to temp in appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async deleteFile(identifier) {
		let content = await this.#appData.load(identifier)
		if (Array.isArray(content)) {
			content.forEach(file => {
				fs.removeSync(`${PROJECT_ROOT}]/tmp/${file.fileID}`)
			})
		} else {
			fs.removeSync(`${PROJECT_ROOT}]/tmp/${content.fileID}`)
		}
		return await this.#appData.delete(identifier)
	}
}