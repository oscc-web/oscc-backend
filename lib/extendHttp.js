import { IncomingMessage } from 'http'

IncomingMessage.prototype.__defineGetter__(
	'origin',
	function () {
		return undefined
			|| this.headers['x-forwarded-for']
			|| this.socket.remoteAddress
			|| this.ip
	}
)

/**
 * Filters the cookies of a request according to given filter
 * @param {(name: String, value: String) => undefined} filter 
 */
IncomingMessage.prototype.filterCookies = function filterCookies(filter) {
	this.headers.cookie = (this.headers.cookie || '')
		.split(/;\s*/g)
		.filter(entry => filter(...entry.split('=', 2)))
		.join('; ')
}