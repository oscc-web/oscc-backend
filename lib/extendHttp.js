import { IncomingMessage } from 'http'
import { internalCookieRx, logger } from './env.js'

IncomingMessage.prototype.__defineGetter__(
	'origin',
	function () {
		return undefined
			|| this.headers['x-forwarded-for']
			|| this.socket.remoteAddress
			|| this.ip
	}
)

IncomingMessage.prototype.__defineGetter__(
	'parsedCookie',
	function () {
		// Try to use cached result
		if ('$parsedCookie' in this) return this.$parsedCookie
		// Raw cookies string joined with '; '
		const raw = this.headers?.cookie || this.cookie || ''
		// Unexpected raw type causes an empty cookie list
		if (typeof raw !== 'string') this.$parsedCookie = {}
		// Parse cookies
		else {
			this.$parsedCookie = Object.fromEntries(
				raw
					// Split cookie entries
					.split(/\s*;\s*/g)
					// Split cookie name and cookie value
					.map(str => str.split(/\s*=\s*/g, 2))
			)
		}
		return this.$parsedCookie
	}
)

IncomingMessage.prototype.__defineGetter__(
	'internalCookie',
	function () {
		// Try to use cached result
		if ('$internalCookie' in this) return this.$internalCookie
		// Parse cookies
		return this.$internalCookie = Object.fromEntries(
			Object
				.entries(this.parsedCookie)
				.filter(([name]) => internalCookieRx.test(name))
				.map(([name, value]) => [
					internalCookieRx.exec(name).groups.name,
					value
				])
		)
	}
)

/**
 * Filters the cookies of a request according to given filter
 * @param {(name: String, value: String) => Boolean} filter
 * Returns whether a cookie will remain
 * true: cookie stays in the header  
 * false: cookie will be deleted from request header
 * @returns {Array}
 * Array containing all deleted cookies
 */
IncomingMessage.prototype.filterCookies = function (filter = () => false) {
	let filteredCookies = []
	this.headers.cookie = this.cookie = (this.headers.cookie || this.cookie || '')
		.split(/;\s*/g)
		.filter(entry => {
			let pass = filter(...entry.split('=', 2))
			if (!pass) filteredCookies.push(entry)
			return pass
		})
		.join('; ')
	return filteredCookies
}

/**
 * Inject cookies to request header according to given object
 * @param {{name: value}} filter
 * Returns whether a cookie will remain
 * true: cookie stays in the header  
 * false: cookie will be deleted from request header
 * @returns {Array}
 * Array containing all deleted cookies
 */
IncomingMessage.prototype.injectCookies = function (cookies) {
	// Clear cached $parsedCookie and $internalCookie since we altered the header
	delete this.$internalCookie
	delete this.$parsedCookie
	// Validate input
	if (!cookies || typeof cookies !== 'object') {
		logger.error('Failed to inject cookies because input is invalid', cookies)
		return
	}
	// Do the injection
	const cookieList = (this.headers?.cookie || '').split(/\s*;\s*/g)
	Object.entries(cookies).forEach((name, value) => {
		// Remove original cookies with the same name
		cookieList.filter(entry => entry.split(/\s*=\s*/, 2)[0] !== name)
		// Convert value to string
		if (typeof value !== 'string' && value !== undefined) {
			value = 'toString' in value
				? value.toString()
				: JSON.stringify(value)
		}
		// Only insert new cookie if 'value' is not empty
		if (!value) {
			logger.warn(`Trying to inject cookie named '${name}' with an empty value`)
			return
		}
		// Check illegal character ';'
		if (/;/g.match()) {
			logger.warn(`Illegal cookie value: ${value}`)
			return
		}
		// Add new value string
		cookieList.push(`${name}=${value}`)
	})
	// Alter request header
	if (!('headers' in this)) this.headers = {}
	this.headers.cookie = cookieList.join('; ')
	this.cookie = this.headers.cookie
}