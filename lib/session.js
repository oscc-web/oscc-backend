import { config, logger, DOMAIN, TODO } from './env.js'
import { init as dbInit } from './mongo.js'
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
	$user
	get user() {
		// Try to user cached user instance
		if (this.$user && this.$user instanceof User) return this.$user
		// Initialize user instance from session descriptor
		return this.$user = new User(this.#dsc?.userID)
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
		// Check if arg is an instance of User
		if (arg instanceof User) {
			const user = arg
			// Create and register a new session for this user
			if (!dsc?.persistent) {
				dsc.persistent = false
				dsc.expires = Date.now() + SESSION_TIMEOUT
				dsc.userID = user.ID
			}
			// Generate unique session token, and store the session into database
			TODO('Lock db.session.write')
			TODO('Generate UNIQUE token')
			TODO('Unlock db.session.write')
		} else {
			// Treat argument as session descriptor
			const descriptor = arg
			if (!descriptor || typeof descriptor !== 'object') throw new TypeError()
			Object.assign(this.#dsc, { token: descriptor._id }, descriptor)
		}
	}

	/**
	 * @returns {Boolean} Indicates whether this session is valid
	 */
	validate() {
		try {
			const dsc = this.#dsc
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

	extendExpiration(timeout = SESSION_TIMEOUT) {
		if (!this.persistent) {
			const expires = Date.now() + timeout
			Session.db.update(
				{ _id: this.#dsc.token },
				{ expires: { $set: expires } }
			)
		}
		return this
	}
	/**
	 * Drop current session from database
	 * @returns {undefined}
	 */
	drop() {
		// Mark this session 'dropped'
		this.#dsc.dropped = true
		// Drop session entry from database
		Session.db.session.drop(TODO('Delete current session from database'))
	}
	/**
	 * Write current session token to response
	 * @param {ServerResponse} res 
	 * @returns {Session}
	 */
	writeToken(res) {
		// cookie() is extended by express.js
		res.cookie(SESSION_TOKEN_NAME, this.#dsc.token, {domain: DOMAIN})
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
		const session = await this.get(req)
		// Check if session exists
		if (!(session instanceof Session)) {
			return next()
		}
		// Check if session is still valid
		if (!session.validate()) {
			session.drop()
			return next()
		}
		// Session has been validated, inject userID into request header
		req.injectCookies({__internal_user_info__: session.user.infoString})
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
	static async get(req) {
		// Extract session token from client request
		// Property 'parsedCookies' is extended by extendHttp.js
		const token = req.parsedCookies?.[SESSION_TOKEN_NAME]
		// Check if token exists
		if (!token || typeof token !== 'string') return null
		// Find session record in database
		const [descriptor] = await this.db.session.find({ _id: token }).toArray()
		// Check if query has an element
		if (!descriptor) {
			return null
		}
		// Try to create session instance from session descriptor
		try {
			return new Session(descriptor)
		} catch (e) {
			logger.error(e.stack)
			return null
		}
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db |= dbInit('session/CRUD')
	}
}