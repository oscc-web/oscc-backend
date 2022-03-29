import { IncomingMessage } from 'http'
import { Rx } from 'lib/env.js'

IncomingMessage.prototype.__defineGetter__(
	'origin',
	function () {
		const origin = undefined
			|| this.headers['x-forwarded-for']
			|| this.socket.remoteAddress
			|| this.ip
		return origin.replace(/^((0000|ffff)?:)*/gi, '')
	}
)

IncomingMessage.prototype.__defineGetter__(
	'parsedCookies',
	function () {
		// Try to use cached result
		if ('$parsedCookies' in this) return this.$parsedCookies
		// Raw cookies string joined with '; '
		const raw = this.headers?.cookie || this.cookie || ''
		// Unexpected raw type causes an empty cookie list
		if (typeof raw !== 'string') this.$parsedCookies = {}
		// Parse cookies
		else {
			this.$parsedCookies = Object.fromEntries(
				raw
					// Split cookie entries
					.split(/\s*;\s*/g)
					// Split cookie name and cookie value
					.map(str => str.split(/\s*=\s*/g, 2))
					// filter empty names and empty values
					.filter(([name, value]) => !!(name && value))
					// Decode URI encoded cookie value
					.map(([name, value]) => [name, decodeURIComponent(value)])
			)
		}
		return this.$parsedCookies
	}
)

IncomingMessage.prototype.__defineGetter__(
	'internalCookies',
	function () {
		// Try to use cached result
		if ('$internalCookies' in this) return this.$internalCookies
		// Parse cookies
		return this.$internalCookies = Object.fromEntries(
			Object
				.entries(this.parsedCookies)
				.filter(([name]) => Rx.internalCookie.test(name))
				.map(([name, value]) => [
					name.replace(Rx.internalCookie, (...args) => args.pop().name),
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
 * @returns {undefined}
 * Array containing all deleted cookies
 */
IncomingMessage.prototype.injectCookies = function (cookies) {
	// Clear cached $parsedCookies and $internalCookies since we altered the header
	delete this.$internalCookies
	delete this.$parsedCookies
	// Validate input
	if (!cookies || typeof cookies !== 'object') {
		throw new TypeError('Invalid input for cookie injection', cookies)
	}
	// Do the injection
	let cookieList = (this.headers?.cookie || '').split(/\s*;\s*/g)
	Object.entries(cookies).forEach(([name, value]) => {
		// Remove original cookies with the same name
		cookieList = cookieList.filter(entry => entry.split(/\s*=\s*/, 2)[0] !== name)
		// Convert non-sting value to string
		if (typeof value !== 'string' && value !== undefined) {
			value = typeof value.toString === 'function'
				? value.toString()
				: JSON.stringify(value)
		}
		// Only insert new cookie if 'value' is not empty
		if (!value)
			throw new TypeError(`Trying to inject cookie named '${name}' with an empty value`)
		// Check illegal character ';'
		if (/;/g.test(value))
			throw new TypeError(`Illegal cookie value: ${value}`)
		// Add new value string
		cookieList.push(`${name}=${encodeURIComponent(value)}`)
	})
	// Alter request header
	if (!('headers' in this)) this.headers = {}
	this.cookie = this.headers.cookie = cookieList.join(';')
}

IncomingMessage.prototype.injectInternalCookies = function (cookies) {
	// Validate input
	if (!cookies || typeof cookies !== 'object')
		throw new TypeError('Failed to inject cookies because input is invalid', cookies)
	return this.injectCookies(Object.fromEntries(
		Object
			.entries(cookies)
			.map(([name, value]) => {
				return [
					Rx.internalCookie.test(name) ? name : `__internal_${name}__`,
					value
				]
			}))
	)
}