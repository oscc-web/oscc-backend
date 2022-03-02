import dbInit from '../utils/mongo.js'
import { identity, logger, PROJECT_ROOT } from './env.js'
import fs from 'fs-extra'
export class AppData {
	#appID
	get appID () { return this.#appID }
	constructor (appID = identity) {
		if (!appID || typeof appID !== 'string') throw new Error('Failed to get application unique identifier')
		this.#appID = appID
	}
	// MongoDB Storage
	async store (content, identifier) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier }, { _id: false, identifier: true }).toArray()
		let result = false
		if (query.length === 0) {
			// Insert new AppData
			let inSertResult = await AppData.db.appData.insert( { content, identifier } )
			result = inSertResult.acknowledged
		} else {
			throw new Error(`Store appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		}
		return result
	}
	async load (identifier) {
		// let arr = identifierArr(identifier)
		let query = (await AppData.db.appData
			.find({ identifier }, { content: true })
			.toArray())
			.map(({ content } = {}) => content)
		if (query.length === 0) {
			return null
		} else {
			let [data] = query
			return data
		}
	}
	async update (content, identifier) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier }).toArray()
		let updated = false
		if (query.length !== 1) {
			throw new Error(`Update appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		} else {
			let query = await this.load(identifier)
			Object.entries(content).forEach(([key, value]) => {
				query[key] = value
			})
			let result = await AppData.db.appData.update({ identifier }, { $set: { content }  })
			updated = !!result.modifiedCount
		}
		return updated
	}
	async delete (identifier) {
		// let arr = identifierArr(identifier)
		let query = await AppData.db.appData.find({ identifier }).toArray()
		let deleted = false
		if (query.length !== 1) {
			throw new Error(`Delete appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		} else {
			let result = await AppData.db.appData.delete({ identifier })
			deleted = !!result.deletedCount
		}
		return deleted
	}
	// Lazy-loaded database connection
	static $db
	static get db () {
		return this.$db ||= dbInit('appData/CRUD')
	}
	// Object naming rules
	get [Symbol.toStringTag] () {
		return `${this.constructor.name} <${this.appID}>`
	}
	
}

export class AppDataWithFs extends AppData {
	constructor (appID) {
		super(appID)
	}
	// File upload plugin
	async acquireFile (identifier) {
		let content = await this.load(identifier)
		if (!content || !content.temp) {
			return null
		}
		content.temp = false
		let acquired = await this.update(content, identifier)
		if (acquired) return content
		return null
	}
	async loadFile (identifier) {
		let content = await this.load(identifier)
		if (!content || content.temp) {
			return null
		}
		return fs.readFileSync(`${PROJECT_ROOT}/tmp/${content.fileID}`)
	}
	async pipeFile (identifier, pipe) {}
	async deleteFile (identifier) {
		let content = await this.load(identifier)
		if (!content || content.temp) {
			return false
		}
		content.temp = true
		let result = await this.update({ content }, identifier)
		return result
	}
}