import dbInit from '../utils/mongo.js'
import OAuth from './oauth.js'
import { keyPair, testKey } from '../utils/crypto.js'

export default class User {
	/**
	 * User properties
	 * Notice: the setter of these properties only checks basic types of these
	 * properties before synchronization with the database.
	 * Any additional type check or authenticity check should be performed BEFORE
	 * actually setting these values.
	 */
	#userID
	get userID() { return this.#userID }
	#name
	get name() { return this.#name }
	set name(value) {
		if (!value || typeof value !== 'string') throw new TypeError()
		this.update({ $set: { name: value } }).then(successful => {
			if (successful) this.#name = value
		})
	}
	#mail
	get mail() { return this.#mail }
	set mail(value) {
		if (!value || typeof value !== 'string') throw new TypeError()
		this.update({ $set: { mail: value } }).then(successful => {
			if (successful) this.#mail = value
		})
	}
	#groups = []
	get groups() { return [...this.#groups] }
	set groups(value) {
		if (
			!value ||
			!Array.isArray(value) ||
			// Check if all array elements are strings
			value.filter(str => !str || typeof str !== 'string').length
		) throw new TypeError()
		this.update({ $set: { mail: value } }).then(successful => {
			if (successful) this.#mail = [...value]
		})
	}
	// There is no getter for user password, the setter method updates the
	// entire password structure.
	// The source of password ('userID' or 'mail') is determined by which
	// identifier was used to locate this user.
	// Eg. if identifier == userID, #password will be password.userID,
	// and if identifier == mail, #password will be password.mail
	#password
	// Warning: since database update is an asynchronous operation, password
	// will take effect shortly AFTER reset, not IMMEDIATELY!!!!!!
	set password(value) {
		if (!value || typeof value !== 'string' || value.length < 5) throw new TypeError()
		const password = keyPair(value)
		this.update({ $set: { password } }).then(successful => {
			if (successful) this.#password = password
		})
	}
	login(password) {
		return testKey(this.#password, password)
	}
	// OAuth is an read-only instance of class OAuth
	#OAuth
	get OAuth() { return this.#OAuth }
	// infoString is a cached string containing basic information of this user.
	// 
	/**
	 * infoString is a cached JSON string containing basic user information.
	 * This getter will try to use cached string in current user document.
	 * If userInfo is modified, this cache will be cleared, and be re-computed
	 * upon next get() request.
	 * @returns {String} Parsed by JSON.stringify()
	 */
	#infoString
	get infoString() {
		if (!this.#infoString) {
			// Cache was cleared, recompute from existing data
			const infoString = JSON.stringify(this.info)
			// Fire an async database update request
			this.update({ $set: { infoString } })
			// Update local infoString cache
			this.#infoString = infoString
		}
		return this.#infoString
	}
	// Full user descriptor (without password)
	get info() {
		const { userID, name = userID, mail, groups } = this
		return {
			name,
			mail,
			groups: [...groups],
		}
	}
	/**
	 * Constructs user instance from db document
	 * @param {{
	 * _id: String | undefined,
	 * userID: String | undefined,
	 * name: String,
	 * mail: String,
	 * groups: [String],
	 * password: {
	 * 	hash: String,
	 * 	salt: String
	 * },
	 * OAuthTokens: {
	 * 	GitHub: UUID,
	 * 	GitLab: UUID,
	 * 	WeChat: UUID,
	 * 	Google: UUID
	 * },
	 * infoString: {
	 * 	content: String,
	 * 	updated: Date
	 * }
	 * }} descriptor The user descriptor extracted from database
	 * @returns {User}
	 */
	constructor(descriptor) {
		const { _id, userID, name, mail, groups, password, OAuthTokens, infoString } = descriptor
		this.#userID = _id || userID
		this.#name = name
		this.#mail = mail
		this.#groups = [...groups]
		this.#password = password
		// Load third party authentication methods
		this.#OAuth = new OAuth(OAuthTokens)
		this.#infoString = infoString
	}
	/**
	 * Update the database document for this user
	 * @param {String} entry Name of the entry to be updated
	 * @param {String | Object} value Value to be set
	 * @returns {Boolean} True if update was successful, otherwise false
	 */
	async update(updateFilter) {
		let updated = false
		if (!updateFilter) {
			// Full upload if filter is omitted
			// infoString will remain the same after full upload
			const updateDoc = {
				password: this.#password,
				...this.info
			}
			// Check if user already exists in database
			let query = await User.db.user.find({ _id: this.userID }, { _id: true, name: true }).toArray()
			if (query.length === 0) {
				// Insert new user
				let result = await User.db.user.insert({ _id: this.userID, ...updateDoc })
				updated = result.acknowledged
			} else if (query.length === 1) {
				// Update existing user 
				let result = await this.update({ $set: { updateDoc } })
				updated = !!result.modifiedCount
			} else {
				throw new Error(`Duplicate identifier <${this.userID}>: ${JSON.stringify(query)}`)
			}
		} else {
			// Update only those specified in updateFilter
			let result = await User.db.user.update({ _id: this.userID }, updateFilter)
			updated = !!result.modifiedCount
		}
		// Clear infoString cache
		if (updated) {
			this.#infoString = undefined
			User.db.user.update({ _id: this.userID }, { $set: { infoString: undefined } })
		}
		return updated
	}
	/**
	 * Get user info from either userID or email
	 * @param {String} identifier 
	 * @returns {User} user instance
	 */
	static async locate(identifier) {
		// Search the database for given identifier
		let results = await this.db.user.find({
			$or: [
				{ _id: identifier },
				{ mail: identifier.toLowerCase() }
			]
		}).toArray()
		// Check if the search ended up with more than one match
		if (results.length > 1) throw new Error(`Duplicate identifier <${identifier}>: ${JSON.stringify(results)}`)
		// Extract descriptor from search result
		let [descriptor] = results
		// Construct user if there is a match
		if (descriptor && typeof descriptor === 'object') return new User(descriptor)
		return null
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('user/CRUD')
	}
}