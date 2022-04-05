import { existsSync } from 'fs'
import { remove } from 'fs-extra'
import { sl } from 'utils/string.js'
import { PROJECT_ROOT } from './env.js'
import { EntryNotFoundError } from './errors.js'
import logger from './logger.js'
const uploadDir = `${PROJECT_ROOT}/var/upload`
export class FileDescriptor {
	/**
	 * UUID
	 * Unique filename when stored in fs
	 */
	#fileID
	/**
	 * @type {String}
	 */
	get fileID() { return this.#fileID }
	/** UserID of file owner */
	#userID
	/**
	 * @type {String}
	 */
	get userID() { return this.#userID }
	/**
	 * @type {Number}
	 */
	get size() { return this.meta.fileSize }
	/**
	 * @type {String}
	 * content-type in header of request
	 */
	get type() { return this.#meta.type }
	/**
	 * @type {String}
	 * content-type in header of request
	 */
	get path() { return this.#meta.filePath }
	/**
	 * Date
	 * create time
	 */
	#meta
	/**
	 * @type {Date}
	 */
	get meta() { return { ...this.#meta } }
	/**
	 * @param {String} fileID
	 * @param {String} userID
	 * @param {{
	 *	{Number} fileSize
	 *	{String} filePath
	 *	{String} type
	 *	{Date} cTime
	 *	{...any} stat
	 * }} param2
	 */
	constructor({ fileID, userID, meta: { fileSize, filePath, type, ...stat } }) {
		// Check if file exists
		if (!existsSync(filePath)) logger.warn(sl`
			| FileDescriptor constructed with non-existent file
			| ${filePath}
		`)
		// Check if file size is valid
		if (!fileSize || typeof fileSize !== 'number') throw new TypeError
		this.#fileID = fileID
		this.#userID = userID
		this.#meta = { fileSize, filePath, type, ...stat }
	}
	/**
	* @param {port('express').Response} res
	* Set the content-type in response heads to this file type
	* Send this file through pipe
	*/
	pipe(res) {
		res.type(this.type)
		res.sendFile(this.path)
	}
	/**
	 * Delete file in fs
	 * @returns {Promise<String}
	 */
	async delete() {
		return await new Promise((res, rej) => {
			remove(`${uploadDir}/${this.#fileID}`, err => {
				if (err) rej(err)
				else res(this.#fileID)
			})
		})
	}
}
