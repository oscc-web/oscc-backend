import { AppData } from './appData.js'
import { FileDescriptor } from './fileDescriptor.js'
import { PID, PROJECT_ROOT, TODO } from './env.js'
import { resolve } from 'path'
import logger from './logger.js'
export const contentDir = resolve(PROJECT_ROOT, 'var/upload')
const fsAppData = new AppData('@upload')
export class AppDataWithFs extends AppData {
	get mark() { return { acquiredBy: this.appID } }
	constructor(appID) {
		super(appID)
	}
	// File upload plugin
	/**
	 * Acquire file in appData
	 * @param {Object} fsIdentifier
	 * @param {Object} identifier
	 * @param {Boolean} [duplicate]
	 * Describe if acquired file can be many
	 * @param {Boolean} [replace]
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 * Add acquiredBy to identifier
	 */
	async acquireFile(fsIdentifier, identifier = fsIdentifier, { duplicate = false, replace = false }) {
		const query = await this.loadFile(identifier, true)
		if (query.length === 0 || duplicate || replace) {
			// If replace is enabled and there exists matching entry, drop existing entries.
			if (query.length && replace){
				await this.deleteFile({ ...identifier, ...this.mark })
			}
			delete fsIdentifier.acquiredBy
			// Acquire file
			return await fsAppData.update(
				fsIdentifier,
				{},
				{ $set: { ...identifier, ...this.mark } }
			)
		} else throw new Error(
			`Acquire appDataWithFs identifier <${
				this.appID
			}>: ${
				JSON.stringify(query)
			}`
		)
	}
	/**
	 * Load file from appData, file can be located by identifier
	 * @param {Object} identifier
	 * @param {Boolean} duplicate
	 * @returns {Promise<FileDescriptor | FileDescriptor[]>}
	 */
	async loadFile(identifier, duplicate = false) {
		const content = await fsAppData.load({ ...identifier, ...this.mark }, { duplicate, mix: true })
		// Check duplicate
		if (duplicate) {
			// Create FileDescriptors for each content
			return content.map(c => new FileDescriptor(c))
		} else if (content) {
			return new FileDescriptor(content)
		} else {
			return null
		}
	}
	/**
	 * @param {Object} identifier
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 * Delete file from disk and mongodb
	 */
	async deleteFile(identifier) {
		const fileDescriptors = await this.loadFile(identifier, true)
		// Delete files from fs
		fileDescriptors.map(async fileDescriptor => {
			await fileDescriptor.delete()
		})
		return await fsAppData.delete(identifier)
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
			if (replace) {
				// Remove all files that would be replaced
				await Promise.all(
					(await fsAppData.load({ userID, url }, { duplicate: true }))
						.map(dsc => new FileDescriptor({ userID, ...dsc }))
						.map(fd => fd
							.delete()
							.catch(e => logger.warn(`Error removing file ${fileID}: ${e?.stack}`))
						)
				)
			}
			await fsAppData.store(
				// Identifier
				{ userID, url },
				// Content
				{ fileID, meta },
				// Params
				{ duplicate, replace }
			)
			return true
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
			new FileDescriptor({ fileID, userID, meta })
				.delete()
				.catch(e => logger.warn(e.stack))
			return false
		}
	}
}
