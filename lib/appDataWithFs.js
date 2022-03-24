import { AppData } from './appData.js'
import { FileDescriptor } from './filDescriptor.js' 
import { PID, PROJECT_ROOT, TODO } from './env.js'
import { resolve } from 'path'
export const contentDir = resolve(PROJECT_ROOT, 'var/upload')
const fsAppData = new AppData('@upload')
export class AppDataWithFs extends AppData {
	constructor(appID = PID) {
		super(appID)
	}
	// File upload plugin
	/**
	 * Acquire file in appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 * Add acquiredBy to identifier
	 */
	async acquireFile(identifier) {
		return await fsAppData.update(
			identifier,
			{},  
			{ $set: { acquiredBy: this.appID } }
		)
	}
	/**
	 * Load file from appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @param {Boolean} duplicate
	 * @returns {Promise<FileDescriptor | FileDescriptor[]>}
	 */
	async loadFile(identifier, duplicate = false) {
		let content = await fsAppData.load(Object.assign(identifier, { acquiredBy: this.appID }), duplicate)
		// check duplicate
		if (duplicate) {
			// create FileDescriptors for each content
			return content.map(c => new FileDescriptor(c.fileID, identifier.userID, c.meta))
		} else if (content) {
			return new FileDescriptor(content.fileID, identifier.userID, content.meta)
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
		let fileDescriptors = await fsAppData.loadFile(identifier, true)
		// Delete files from fs
		fileDescriptors.map(fileDescriptor => {
			fileDescriptor.delete()
		})
		return this.delete({ identifier, appID: this.appID })
	}
	/**
	 * 
	 * @param {String} fileID 
	 * @param {String} userID
	 * @param {String} url 
	 * @param {Object} meta 
	 * meta content fileSize, filePath, header in request, file stat
	 * @param {...Object} args
	 * store options
	 */
	static async registerFileUpload(fileID, userID, url, meta, ...args) {
		// await appData.store({ userID: user.userID, path:req.url }, { fileID, acquired:false, cTime: new Date(), type: req.headers?.['content-type'], size: totalSize })
		await fsAppData.store({ userID, url }, { fileID, meta },  ...args )
	}
}