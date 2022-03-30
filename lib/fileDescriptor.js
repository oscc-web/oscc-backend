import fs from 'fs-extra'
import { PROJECT_ROOT } from './env.js'
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
	/**
	 * Number
	 * File fileSize
	 */
	#fileSize
	/**
	 * @type {Number}
	 */
	get fileSize() { return this.#fileSize }
	/**
	 * String
	 * Content-type in request header
	 */
	#type
	/**
	 * @type {String}
	 * content-type in header of request
	 */
	get type() { return this.#type } 
	// UserID of uploader
	#userID
	/**
	 * @type {String}
	 */
	get userID() { return this.#userID }
	/**
	 * Date
	 * create time
	 */
	#cTime
	/**
	 * @type {Date}
	 */
	get cTime() { return this.#cTime } 
	/**
	 * Other despitions of file
	 */
	#stat
	get stat() { return this.#stat }
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
	constructor(fileID, userID, { fileSize, filePath, type, cTime, ...stat }) {
		this.#fileID = fileID
		this.#userID = userID
		this.#fileSize = fileSize
		this.#type = type
		this.#cTime = cTime
		this.#stat = stat
	}

	
	

	/**
	* @param {import('express').Response} res
	* Set the content-type in response heads to this file type
	* Send this file through pipe
	*/
	pipe(res) {
		// res.pipe()
		res.type(this.#type)
		res.sendFile(`${uploadDir}/${this.#fileID}`)
	}
	/**
	 * delete file in fs
	 * @returns {Promise<String}
	 */
	async delete() {
		return await new Promise((res, rej) => {
			fs.remove(`${uploadDir}/${this.#fileID}`, err => {
				if (err) rej(err)
				else res(this.#fileID)
			})
		})
	}
}
