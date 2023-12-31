import { seed } from 'utils/crypto.js'
import { config, DOMAIN } from './env.js'
import logger from './logger.js'
import dbInit from 'utils/mongo.js'
import User from './user.js'
import CustomObject from 'utils/customObject.js'
// The cookie field-name to store session token
export const SESSION_TOKEN_NAME = config?.session?.tokenName || 'token'
// The expiration timeout of non-persistent session
export const SESSION_TIMEOUT = config?.session?.timeout || 3600_000
// Session class
export default class Session extends CustomObject {
	// Session descriptor
	#dsc = {}
	// Lazy-loaded user instance
	#user
	/**
	 * @returns {Promise<String> | String}
	 */
	get token() {
		if (!this.#dsc.token) throw new Error(
			'Session has not been initiated, call init() before accessing the token.'
		)
		return this.#dsc.token
	}
	/**
	 * Impacts performance, use with caution
	 * @returns {Promise<User> | User}
	 */
	get user() {
		// Try to user cached user instance
		if (this.#user && this.#user instanceof User) return this.#user
		// Initialize user instance from session descriptor
		// This is an async operation
		return User.locate(this.#dsc?.userID).then(user => {
			return this.#user = user
		})
	}
	/**
	 * @returns {Promise<String> | String}
	 */
	get userID() {
		if (this.#user && this.#user instanceof User) return this.#user.userID
		// Initialize userID from session descriptor
		// This is an async operation
		return this.#dsc?.userID
	}
	/**
	 * 'userInfoString' is a cached JSON string containing basic user information.
	 * This getter will try to use cached string in current user document.
	 * If userInfo is modified, this cache will be cleared, and be re-computed
	 * upon next get() request.
	 * @returns {String} Parsed by JSON.stringify()
	 */
	get userInfoString() {
		if (this.#user && this.#user instanceof User) return JSON.stringify(this.#user.info)
		// Initialize user infoString from session descriptor
		// This is an async operation
		return this.#dsc?.userInfoString
	}
	/**
	 * @returns {Boolean} Indicates whether this session is valid
	 */
	get valid() {
		try {
			const dsc = this.#dsc
			// Check if session has a valid userID
			if (!dsc.userID) return false
			// Check if session has been dropped
			if (dsc.dropped) return false
			// Check session type
			if (!dsc.persistent) {
				// Check if session has expired
				if (dsc.expires < Date.now()) {
					logger.errAcc(`Session <${dsc.token}> expired for userID:${dsc.userID}`)
					return false
				}
			}
			return true
		} catch (e) {
			logger.warn(`Unexpected error during session validation: ${e.stack}`)
			return false
		}
	}
	/**
	 * Session constructor
	 * @param {{
	 * 	token: String,
	 * 	userID: String,
	 * 	persistent: Boolean,
	 * 	expires: Number | undefined,
	 * 	initiator: String
	 * } | User} arg Session descriptor.
	 * @param {{
	 * 	persistent: Boolean,
	 * 	initiator: String,
	 * 	origin: String,
	 * }} dsc Session descriptor
	 * The descriptor passed into constructor should originate from a trusted source,
	 * in most cases, directly come from the session collection of our database.
	 */
	constructor(arg, dsc = {}) {
		super()
		let descriptor
		// Check if arg is an instance of User
		if (arg instanceof User) {
			const user = this.#user = arg, { userID } = user
			descriptor = { ...dsc, userID }
			// Create and register a new session for this user
			if (!descriptor?.persistent) {
				descriptor.persistent = false
				descriptor.expires = Date.now() + SESSION_TIMEOUT
			}
			descriptor.userInfoString = JSON.stringify(user.info)
			logger.info(`${user} logged in from ${dsc.origin} with user-agent ${dsc.initiator}`)
		} else {
			// Treat argument as session descriptor
			descriptor = arg
			if (!descriptor || typeof descriptor !== 'object') throw new TypeError
		}
		// Assign to #dsc
		Object.assign(this.#dsc, descriptor)
		// Initiate this.#dsc.token as a promise, which replaces itself with actual token
		if (typeof this.#dsc?.token !== 'string') this.#dsc.token = this.#getToken()
	}
	/**
	 * Generates unique session token and insert the session into database
	 * @returns {Promise<String>}
	 */
	async #getToken() {
		// Generate unique session token, and store the session into database
		let result
		while (!result?.acknowledged) {
			result = await Session.db.insert({
				...this.#dsc,
				_id: seed(64)
			})
		}
		return this.#dsc.token = result.insertedId
	}
	/**
	 * Extend the session expiration time for a certain period.
	 * The default length is the SESSION_TIMEOUT
	 * @param {import('express').Request} res
	 * @param {Number} timeout
	 * @returns {Promise(session)}
	 */
	async extendExpiration(res, timeout = SESSION_TIMEOUT) {
		if (!this.#dsc.persistent) {
			const expires = Date.now() + timeout
			Session.db.update(
				{ _id: this.#dsc.token },
				{ $set: { expires } }
			)
			await this.writeToken(res)
		}
		return this
	}
	/**
	 * Drop current session from database
	 * @returns {undefined}
	 */
	async drop() {
		// Drop session entry from database
		return await Session.db.delete({ _id: this.#dsc?.token }).then(result => {
			// Mark this session 'dropped'
			if (result.acknowledged && result.deletedCount) this.#dsc.dropped = true
			return result
		})
	}
	/**
	 * Write current session token to response
	 * @param {import('express').Response} res
	 * @returns {Promise<Session>}
	 */
	async writeToken(res) {
		const expires = this.#dsc.persistent
			? new Date('9999-01-01T00:00:00.000Z')
			: new Date(Date.now() + SESSION_TIMEOUT)
		// Cookie() is extended by express.js
		res.cookie(
			SESSION_TOKEN_NAME,
			encodeURIComponent(await this.#dsc.token),
			{
				domain: DOMAIN,
				expires
			}
		)
		return this
	}
	// ------------------------------------------------------------------------
	// Static methods
	// ------------------------------------------------------------------------
	/**
	 * Clear session cookie of given request
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 * @returns {import('express').Response}
	 */
	static clearCookie(req, res) {
		// `clearCookie` is extended by express.js
		for (const el in req.parsedCookies) {
			logger.debug(`clearing cookie ${el}=${req.parsedCookies[el]}`)
			res.clearCookie(el)
			res.clearCookie(el, { domain: DOMAIN })
			res.clearCookie(el, { domain: `.${DOMAIN}` })
		}
		req.filterCookies(() => true)
		return res
	}
	// ------------------------------------------------------------------------
	// Private session utility functions
	// These functions are not public APIs, and are not version-controlled
	// ------------------------------------------------------------------------
	/**
	 * Find session descriptor from session collection.
	 * Create a session instance if
	 * @param {import('express').Request} req Incoming client request
	 * @returns {Session | null} session instance (null if no match)
	 */
	static async locate(req) {
		// Extract session token from client request
		// Property 'parsedCookies' is extended by extendHttp.js
		const token = req.parsedCookies?.[SESSION_TOKEN_NAME]
		logger.debug(`Extracted session token: ${token}`)
		// Check if token exists
		if (!token || typeof token !== 'string') return null
		// Find session record in database
		const [descriptor] = await Session.db.find(
			{ _id: token },
			{ _id: false }
		).toArray()
		// Check if query has an element
		if (!descriptor) {
			logger.errAcc('No session found for this request')
			return null
		}
		// Try to create session instance from session descriptor
		try {
			const session = new Session({ token, ...descriptor })
			logger.debug(`Extracted session: ${session}`)
			return session
		} catch (e) {
			logger.error(`Error creating session instance with descriptor ${JSON.stringify(descriptor)}: ${e.stack}`)
			return null
		}
	}
	static async updateUserInfoString(userID, userInfoString) {
		return await this.db.update({ userID }, { $set: { userInfoString } }).then(result => {
			if (result.acknowledged && result.modifiedCount) return true
			return false
		})
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return (this.$db ||= dbInit('session/CRUD')).session
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return this.userID }
}
