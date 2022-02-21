import { TODO } from './env.js'

export default class User {
	/**
	 * A JSON string containing basic user information.
	 * This getter will try to use cached string in current user document.
	 * If userInfo is modified, then it will update the JSON string and update
	 * cache correspondingly.
	 * @returns {String} Parsed by JSON.stringify()
	 */
	get infoString() {
		TODO()
		return undefined
	}
}