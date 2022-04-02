import { AppData } from './appData.js'
import { FileDescriptor } from './fileDescriptor.js'
import { PID, PROJECT_ROOT, TODO } from './env.js'
import { resolve } from 'path'
import logger from './logger.js'
export const contentDir = resolve(PROJECT_ROOT, 'var/upload')
const fsAppData = new AppData('@upload')
export class AppDataWithFs extends AppData {
	get mark() { return { acquiredBy: this.appID } }
	constructor(appID = PID) {
		super(appID)
	}
	// File upload plugin
	/**
	 * Acquire file in appData
	 * @param {Object | String | Number | Boolean} identifier
	 * @param {Boolean} [duplicate]
	 * Describe if acquired file can be many
	 * @param {Boolean} [replace]
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 * Add acquiredBy to identifier
	 */
	async acquireFile(identifier, { duplicate = false, replace = false }) {
		const query = await this.loadFile(identifier, true)
		let result = null
		if (query.length === 0 || duplicate || replace) {
			// If replace is enabled and there exists matching entry, drop existing entries.
			if (query.length && replace){
				await this.deleteFile({ ...identifier, ...this.mark })
			}
			delete identifier.acquiredBy
			// Acquire file
			result = await fsAppData.update(
				identifier,
				{},
				{ $set: this.mark }
			)
		} else {
			throw new Error(`Acquire appDataWithFs identifier <${this.appID}>: ${JSON.stringify(query)}`)
		}
		return result
	}
	/**
	 * Load file from appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier
	 * @param {Boolean} duplicate
	 * @returns {Promise<FileDescriptor | FileDescriptor[]>}
	 */
	async loadFile(identifier, duplicate = false) {
		const content = await fsAppData.load({ ...identifier, ...this.mark }, { duplicate, mix: true })
		// Check duplicate
		if (duplicate) {
			// Create FileDescriptors for each content
			return content.map(c => new FileDescriptor(c.fileID, c.userID, c.meta))
		} else if (content) {
			return new FileDescriptor(content.fileID, content.userID, content.meta)
		} else {
			return null
		}
	}
	/**
	 *
	 * @param {Object | String | Number | Boolean} identifier
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 * Delete file from disk and mongodb
	 */
	async deleteFile(identifier) {
		const fileDescriptors = await this.loadFile(identifier, true)
		// Delete files from fs
		fileDescriptors.map(async fileDescriptor => {
			await fileDescriptor.delete()
		})
		return fsAppData.delete(identifier)
	}
	/**
	 * @param {String} fileID
	 * @param {String} userID
	 * @param {String} url
	 * @param {Object} meta
	 * meta content fileSize, filePath, header in request, file stat
	 * @param {{
	 * 	duplicate: Boolean,
	 * 	replace: Boolean
	 * }} params
	 * store options
	 */
	static async registerFileUpload(
		fileID, userID, url, meta,
		{ duplicate = false, replace = false } = {}
	) {
		try {
			await fsAppData.store(
				// Identifier
				{ userID, url },
				// Content
				{ fileID, meta },
				// Params
				{ duplicate, replace }
			)
		} catch (e) {
			logger.warn(
				`Failed to save file ${
					fileID
				} from User <${
					userID
				}> (${
					JSON.stringify({ duplicate, replace })
				}): ${
					e.stack
				}`)
			// Remove unsuccessful file upload
			new FileDescriptor(fileID, userID, meta).delete().catch(e => logger.warn(e.stack))
		}
	}
}
