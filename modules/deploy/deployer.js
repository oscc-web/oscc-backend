import { AppDataWithFs } from 'lib/appData.js'
import CustomObject from 'utils/customObject.js'

export default class Deployer extends CustomObject {
	/**
	 * @type {String} ID of this deployer
	 */
	#id
	get id() { return this.#id }
	/**
	 * The static file server 
	 * @type {import('express').Express}
	 */
	#server
	

	constructor(id) {
		super()
		this.#id = id
	}
	
	static #appData = new AppDataWithFs()
	static get appData() { return this.#appData }
}
