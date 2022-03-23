import { PROJECT_ROOT } from './env.js'
const uploadDir = `${PROJECT_ROOT}/var/upload`
export class FileDescriptor {
	/**
	 * UUID
	 * Unique filename when stored in fs
	 */
	#fileID
	/**
	 * Number
	 * File size
	 */
	#size
	/**
	 * String
	 * Content-type in request header
	 */
	#type
	// Uploader is an instance of User, recording the owner of file
	#uploader
	/**
	 * Date
	 * create time
	 */
	#cTime
	/**
	 * Date
	 * latest access time
	 */
	#aTime
	/**
	 * Date
	 * latest modify time
	 */
	#mTime

	/**
	 * @param {{fileID: String, size: Number, type: String, uploader: import('./user.js'), cTime: Date, aTime: Date, mTime: Date,}} param 
	 */
	constructor({ fileID, size, type, uploader, cTime, aTime, mTime }) {
		this.#fileID = fileID
		this.#size = size
		this.#type = type
		this.#uploader = uploader
		this.#cTime = cTime
		this.#aTime = aTime
		this.#mTime = mTime
	}
	/**
	 * @type {Number}
	 */
	get size() {return this.#size}
	/**
	 * @type {String}
	 */
	get type() {return this.#type} // MIME Type
	/**
     * @type {Date}
     */
	get cTime() {return this.#cTime} 
	
	set cTime(cTime) {
		this.#cTime = cTime
	}
	/**
     * @type {Date}
     */
	get aTime() {return this.#aTime} 

	set aTime(aTime) {
		this.#aTime = aTime
	}
	/**
     * @type {Date}
     */
	get mTime() {return this.#mTime} 

	set mTime(mTime) {
		this.#mTime = mTime
	}
	/**
     * @type {User}
     */
	get uploader() {return this.#uploader}
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
}