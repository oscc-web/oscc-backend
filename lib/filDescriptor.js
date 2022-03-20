import { PROJECT_ROOT } from './env.js'

export class FileDescriptor {
	#fileID

	#size

	#type

	#uploader

	constructor({ fileID, size, type, uploader }) {
		this.#fileID = fileID
		this.#size = size
		this.#type = type
		this.#uploader = uploader
	}
	get size() {return this.#size}
	get type() {return this.#type} // MIME Type
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
		res.sendFile(`${PROJECT_ROOT}/tmp/${this.#fileID}`)
	}
}