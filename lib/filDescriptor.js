import { PROJECT_ROOT } from './env.js'
const uploadDir = `${PROJECT_ROOT}/var/upload`
export class FileDescriptor {
	#fileID

	#size

	#type

	#uploader

	#cTime
	
	#aTime

	#mTime

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
    */
	pipe(res) {
		// res.pipe()
		res.type(this.#type)
		res.sendFile(`${uploadDir}/${this.#fileID}`)
	}
}