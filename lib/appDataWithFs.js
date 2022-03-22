import fs from 'fs-extra'
import { AppData } from './appData.js'
import { FileDescriptor } from './filDescriptor.js' 
import { PID, PROJECT_ROOT, TODO } from './env.js'
const uploadDir = `${PROJECT_ROOT}/var/upload`
export class AppDataWithFs extends AppData {
	#appData = new AppData('upload')
	constructor(appID = PID) {
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
	 * @param {Boolean} duplicate
	 * @returns {Promise<FileDescriptor | FileDescriptor[]>}
	 */
	async loadFile(identifier, duplicate = false) {
		let content = await this.#appData.load(identifier, duplicate)
		if (Array.isArray(content) && duplicate) {
			let files = []
			content.forEach(fileInfo => {
				if (fileInfo.acquired) files.push(new FileDescriptor({ fileID:identifier.fileID, size: fileInfo.size, type: fileInfo.type, uploader: identifier.user, cTime:fileInfo.cTime, aTime:fileInfo.aTime, mTime:fileInfo.mTime }))
			})
			return files
		} else if (!Array.isArray(content) && !duplicate) {
			if (!content.acquired) return null
			return new FileDescriptor({ fileID:identifier.fileID, size: content.size, type: content.type, uploader: identifier.user, cTime:content.cTime, aTime:content.aTime, mTime:content.mTime })
		} else {
			throw new Error(`Load appData identifier <${this.appID}>: ${JSON.stringify(content)}`)
		}
	}
	/**
	 * Change the file type to temp in appData, file can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier 
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async deleteFile(identifier) {
		let content = await this.#appData.load(identifier)
		if (Array.isArray(content)) {
			content.forEach(file => {
				fs.removeSync(`${uploadDir}/${file.fileID}`)
			})
		} else {
			fs.removeSync(`${uploadDir}/${content.fileID}`)
		}
		return await this.#appData.delete(identifier)
	}
}