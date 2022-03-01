import dbInit from '../utils/mongo.js'
import { keyPair, testKey } from '../utils/crypto.js'
import OAuth from './oauth.js'
import Group from './groups.js'
import { logger, TODO } from './env.js'
import { PRIV } from './privileges.js'
import Session from './session.js'

export default class User {
	/**
	 * User properties
	 * Notice: the setter of these properties only checks basic types of these
	 * properties before synchronization with the database.
	 * Any additional type check or authenticity check should be performed BEFORE
	 * actually setting these values.
	 */
	#userID
	/**
	 * @type {String}
	 */
	get userID() { return this.#userID }
	/**
	 * @type {String | Promise<String>}
	 */
	#name
	get name() { return this.#name }
	set name(value) {
		if (!value || typeof value !== 'string') throw new TypeError()
		const prev = this.#name
		this.#name = this
			.update({ $set: { name: value } })
			.then(successful => {
				return this.#name = successful ? value : prev
			})
	}
	#mail
	/**
	 * @type {String | Promise<String>}
	 */
	get mail() { return this.#mail }
	set mail(value) {
		if (!value || typeof value !== 'string') throw new TypeError()
		const prev = this.#mail
		this.#mail = this
			.update({ $set: { mail: value } })
			.then(successful => {
				return this.#mail = successful ? value : prev
			})
	}
	/**
	 * @type {Group[] | Promise<Group[]>}
	 */
	#groups = []
	/**
	 * @type {Group[] | Promise<Group[]>}
	 */
	get groups() {
		if (this.#groups instanceof Promise) return this.#groups.then(() => this.groups)
		if (!Array.isArray(this.#groups)) throw new TypeError
		return [...this.#groups]
	}
	/**
	 * Add user into an existing group
	 * @param {String} groupId 
	 * @returns {Promise<Boolean>} whether the operation is successful
	 */
	async joinGroup(groupId) {
		TODO(groupId)
	}
	/**
	 * Remove user from a group
	 * @param {String} groupId 
	 * @returns {Promise<Boolean>} whether the operation is successful
	 */
	async leaveGroup(groupId) {
		TODO(groupId)
	}
	/**
	 * Tells if user has given privilege
	 * @param {PRIV | String} priv 
	 */
	async hasPriv(priv) {
		// Merge all group's corresponding privilege
		return (await this.#groups)
			.map(group => {
				return group.hasPriv(priv)
			})
			.reduce((a, b) => a || b)
	}
	/**
	 * Get visible groups of current user from viewer's perspective
	 * @param {User} targetUser 
	 * @returns {Promise<Group[]>}
	 */
	async viewGroups(targetUser) {
		if (!(targetUser instanceof User)) throw new TypeError
		// Check if this user has 'ALTER_GROUP' privilege 
		if (await this.hasPriv(PRIV.ALTER_USER_GROUP)){
			return await targetUser.groups
		} else {
			// Check if viewer is the same person as targeted user
			let sameUser = targetUser.userID == this.userID
			logger.verbose(`Viewing groups of ${targetUser} as ${this}, same-user = ${sameUser}`)
			// Wait for this user's group to be instantiated
			let selfGroups = await this.groups
			// This user is not privileged to alter others' group,
			// filter visible groups according to group.hasView
			return (await targetUser.groups).filter(
				group => group.hasView(sameUser, ...selfGroups)
			)
		}
	}
	// There is no getter for user password, the setter method updates the
	// entire password structure.
	// The source of password ('userID' or 'mail') is determined by which
	// identifier was used to locate this user.
	// Eg. if identifier == userID, #password will be password.userID,
	// and if identifier == mail, #password will be password.mail
	/**
	 * @type {{hash: String, salt: String} | Promise<{hash: String, salt: String}>}
	 */
	#password
	// Warning: since database update is an asynchronous operation, password
	// will take effect shortly AFTER reset, not IMMEDIATELY!!!!!!
	set password(value) {
		if (!value || typeof value !== 'string' || value.length < 5) throw new TypeError()
		const password = keyPair(value), prev = this.#password
		this.#password = this.update({ $set: { password } }).then(successful => {
			return this.#password = successful
				? password
				: prev
		})
	}
	/**
	 * Check if given password matches our record
	 * @param {String} password 
	 * @returns {Promise<Boolean>}
	 */
	async login(password) {
		return testKey(await this.#password, password)
	}
	// OAuth is an read-only instance of class OAuth
	#OAuth
	get OAuth() { return this.#OAuth }
	/**
	 * Full user descriptor (without password and groups)
	 * @type {{name: String, mail: String}}
	 */
	get info() {
		const { userID, name = userID, mail } = this
		return {
			name,
			mail
		}
	}
	/**
	 * Constructs user instance from db document
	 * @param {{
	 * _id: String | undefined,
	 * userID: String | undefined,
	 * name: String,
	 * mail: String,
	 * groups: String[] | undefined,
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
		const { _id, userID, name, mail, groups = [], password, OAuthTokens } = descriptor
		this.#userID = _id || userID
		this.#name = name
		this.#mail = mail
		this.#password = password
		// Asynchronously load group instances
		this.#groups = Group
			.locate(groups)
			.then(groups => {
				this.#groups = [...groups]
				return this.#groups
			})
		// Load third party authentication methods
		this.#OAuth = new OAuth(OAuthTokens)
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
				...this.info,
				groups: (await this.groups).map(group => group.id)
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
			await Session.updateUserInfoString(this.#userID, JSON.stringify(this.info))
		}
		return updated
	}
	/**
	 * Get user info from either userID or email
	 * @param {String} identifier 
	 * @returns {User} user instance
	 */
	static async locate(identifier) {
		if (!identifier || typeof identifier !== 'string') return null
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
	// Object naming rules
	get [Symbol.toStringTag]() {
		return `${this.constructor.name} <${this.userID}>`
	}
}