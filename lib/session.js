import { seed } from '../utils/crypto.js'
import { config, logger, DOMAIN } from './env.js'
import dbInit from '../utils/mongo.js'
import User from './user.js'
// The cookie field-name to store session token
const SESSION_TOKEN_NAME = config?.session?.tokenName || 'token'
// The expiration timeout of non-persistent session
const SESSION_TIMEOUT = config?.session?.timeout || 360_000
// Session class
export default class Session {
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
	 * 	initiator: String
	 * }} dsc Session descriptor
	 * The descriptor passed into constructor should originate from a trusted source,
	 * in most cases, directly come from the session collection of our database.
	 */
	constructor(arg, dsc = {}) {
		let descriptor
		// Check if arg is an instance of User
		if (arg instanceof User) {
			const user = this.#user = arg
			descriptor = dsc
			// Create and register a new session for this user
			if (!descriptor?.persistent) {
				descriptor.persistent = false
				descriptor.expires = Date.now() + SESSION_TIMEOUT
				descriptor.userID = user.userID
			}
		} else {
			// Treat argument as session descriptor
			descriptor = arg
			if (!descriptor || typeof descriptor !== 'object') throw new TypeError()
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
			result = await Session.db.session.insert({
				...this.#dsc,
				_id: seed(64)
			})
		}
		return this.#dsc.token = result.insertedId
	}
	/**
	 * Extend the session expiration time for a certain period.
	 * The default length is the SESSION_TIMEOUT
	 * @param {Number} timeout 
	 * @returns 
	 */
	extendExpiration(timeout = SESSION_TIMEOUT) {
		if (!this.persistent) {
			const expires = Date.now() + timeout
			Session.db.update(
				{ _id: this.#dsc.token },
				{ $set: { expires: expires } }
			)
		}
		return this
	}
	/**
	 * Drop current session from database
	 * @returns {undefined}
	 */
	async drop() {
		// Drop session entry from database
		return await Session.db.session.delete({ _id: this.#dsc?.token }).then(result => {
			// Mark this session 'dropped'
			if (result.acknowledged && result.deletedCount) this.#dsc.dropped = true
			return result
		})
	}
	/**
	 * Write current session token to response
	 * @param {ServerResponse} res 
	 * @returns {Session}
	 */
	writeToken(res) {
		// cookie() is extended by express.js
		res.cookie(SESSION_TOKEN_NAME, this.#dsc.token, { domain: DOMAIN })
		return this
	}
	// ------------------------------------------------------------------------
	// Static methods
	// ------------------------------------------------------------------------
	/**
	 * Extract and validate session token, inject internal cookies if session
	 * is valid.
	 * All requests will be passed down, but only those which has a valid
	 * session will be injected an internal cookie.
	 * @param {IncomingMessage} req 
	 * @param {ServerResponse} res 
	 * @param {Function} next 
	 */
	static async preprocessor(req, res, next) {
		// Find correlated session
		const session = await Session.locate(req)
		// Check if session exists
		if (!(session instanceof Session)) {
			return next()
		}
		// Check if session is still valid
		if (!session.valid) {
			session.drop()
			return next()
		}
		// Session has been validated, inject userID into request header
		req.injectCookies({
			__internal_userInfoString__: (await session.user).infoString,
			__internal_userID__: (await session.user).userID
		})
		// Pass down to next server
		return next()
	}
	// ------------------------------------------------------------------------
	// Private session utility functions
	// These functions are not public APIs, and are not version-controlled
	// ------------------------------------------------------------------------
	/**
	 * Find session descriptor from session collection.
	 * Create a session instance if 
	 * @param {IncomingMessage} req Incoming client request
	 * @returns {Session | null} session instance (null if no match)
	 */
	static async locate(req) {
		// Extract session token from client request
		// Property 'parsedCookies' is extended by extendHttp.js
		const token = req.parsedCookies?.[SESSION_TOKEN_NAME]
		// Check if token exists
		if (!token || typeof token !== 'string') return null
		// Find session record in database
		const [descriptor] = await Session.db.session.find(
			{ _id: token },
			{ _id: false }
		).toArray()
		// Check if query has an element
		if (!descriptor) {
			return null
		}
		// Try to create session instance from session descriptor
		try {
			return new Session({ token, ...descriptor })
		} catch (e) {
			logger.error(e.stack)
			return null
		}
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('session/CRUD')
	}
}