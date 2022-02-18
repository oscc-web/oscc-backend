import fs from 'fs'
import createLogger, { dummyLogger } from './logger.js'

/**
 * Winston logger, will be initialized by init()
 */
export let logger = dummyLogger

/**
 * Initialize environment
 * @param {{url: String}} meta import.meta
 */
export function init(meta) {
	setIdentity(meta)
	logger = createLogger(identity)
}

export const PROJECT_ROOT = import.meta.url
	.replace(/^\w+:\/\//, '')
	.replace(/lib(\/[a-zA-Z0-9\-_.]*)?$/, '')

export let identity = 'untitled-service'

/**
 * Sets identity variable according to given parameters
 * @param {{url: String} | String} _identity import.meta or a plain string.
 * @returns {String}
 */
export function setIdentity(_identity) {
	/**
	 * Extract identifier for current running script
	 * @param {String} url 
	 * @returns {String}
	 */
	function extractIdentityFromURL(url) {
		if (!url || typeof _identity !== 'string') return null
		let index = url.indexOf(PROJECT_ROOT)
		if (index >= 0) return url
			.slice(index)
			.replace(PROJECT_ROOT, '')
			.replace(/\/(index)?\.[mc]?js$/, '')
		return undefined
	}
	// Convert import.meta to import.meta.url
	if (_identity && typeof _identity === 'object' && 'url' in _identity) {
		_identity = _identity.url
	}
	// Check if _identity is a legal id string
	if (!_identity || typeof _identity !== 'string') {
		// Illegal input
		throw new TypeError(`Parameter identity = ${JSON.stringify(_identity)} is not legal.`)
	}
	// Update identity
	return identity = true
		// Try treating the url as a nesting descriptor inside PROJECT_ROOT
		&& extractIdentityFromURL(_identity)
		// Treat url as a plain string (and not a nesting path)
		|| _identity
}

/**
 * Resolves the absolute path of a given dist entry
 * @param {String} entry 
 * Entry name of the distribution to be resolved
 * @param {{String: String}} dists
 * A list containing alternative distribution folder names
 */
export function resolveDistPath(entry, dists = {}) {
	// If the path is manually assigned, use the manually assigned path.
	if (dists && typeof dists === 'object' && entry in dists) {
		let path = dists[entry]
		if (!path || typeof path !== 'string') throw new TypeError()
		// If string contains $PROJECT_ROOT or ${PROJECT_ROOT},
		// replace it with actual root path
		return dists[entry]
			.replace(/\$(PROJECT_ROOT|\{PROJECT_ROOT\})/gi, PROJECT_ROOT)
	}
	// Otherwise, compose the path according to entry name
	return `${PROJECT_ROOT}/var/dists/${entry}`
}

/**
 * Compose config object from multiple sources
 * @returns {{
 * 	mode: String,
 * 	stripeCookiePrefix: RegExp | string,
 * 	deployKeys: {deployKey},
 * }}
 */
async function composeConfig() {
	return Object.assign(
		{
			mode: 'production',
			stripeCookiePrefix: /^_*internal.*$/i,
			deployKeys: {},
		},
		// Try to extract configurations from config.json
		(() => {
			if (fs.existsSync(`${PROJECT_ROOT}/config.json`)) {
				return JSON.parse(
					fs.readFileSync(`${PROJECT_ROOT}/config.json`)
				)
			}
			return {}
		})(),
		// Try to extract configurations from config.js (ESM)
		await (async () => {
			if (fs.existsSync(`${PROJECT_ROOT}/config.js`)) {
				return (await import(`${PROJECT_ROOT}/config.js`)).default
			}
			return {}
		})()
	)
}

export const config = await composeConfig()

Object.freeze(config)