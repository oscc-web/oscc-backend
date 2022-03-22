import cluster from 'cluster'
// Environment constants
// This block should stay at top
export const Rx = {
	get internalCookie() { return /^_{2,}INTERNAL_*(?<name>.*?)_*$/gi },
	get mail() { return /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-z]{1,3}$/gi },
	get ID() { return /^[a-z][a-z0-9\-_]{4,15}$/gi },
	get devMode() { return /^((dev(elopment)?)|debug|dbg)$/i }
}
// Module imports
import composeArgs from '../utils/args.js'
export const { __COMMAND__, ...Args } = await composeArgs()
// Path of the root of project
export const PROJECT_ROOT = import.meta.url
	.replace(/^\w+:\/\//, '')
	.replace(/\/lib(\/[a-z0-9\-_.]*)?$/, '')
// Configuration files for current project
import { composeConfig } from '../utils/conf.js'
export const config = Object.freeze(await composeConfig(PROJECT_ROOT))
// The top-level domain we are currently serving for
export const DOMAIN = config?.topDomain || config?.domain || 'ysyx.org'
// Boolean indicating if current process is running in development mode
export const IS_DEVELOPMENT_MODE = Args.mode === 'DEVELOPMENT'
// Process ID, parsed from the path relative to PROJECT_ROOT
export const PID = extractIdentityFromURL(process.argv[1]) || 'untitled'
const info = [
	IS_DEVELOPMENT_MODE ? 'dev' : '',
	cluster.isWorker ? 'clustered' : ''
].filter(el => !!el).join(', ')
process.title = `${(config.domain || 'ysyx').toUpperCase()} ${
	(Args.__COMMAND__ === 'run') ? PID : Args.__COMMAND__ || PID
}${info ? ` (${info})` : ''}`
/**
 * Handy tool that breaks execution on incomplete code blocks
 */
export function TODO(...info) {
	throw new SyntaxError(...info)
}
/**
 * Resolves the absolute path of a given dist entry
 * @param {String} entry 
 * Entry name of the distribution to be resolved
 * @param {{dist: String}} dists
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
			.replace(/\$(PROJECT_ROOT|\{\s*PROJECT_ROOT\s*\})/gi, PROJECT_ROOT)
	}
	// Otherwise, compose the path according to entry name
	return `${PROJECT_ROOT}/var/dists/${entry}`
}
// Import custom extensions
import '../utils/extendHttp.js'
/**
 * Extract identifier for current running script
 * @param {String} url 
 * @returns {String}
 */
export function extractIdentityFromURL(url) {
	if (url && typeof url === 'string') {
		let index = url.indexOf(PROJECT_ROOT)
		if (index >= 0) return url
			.slice(index + PROJECT_ROOT.length)
			.replace(/\/?(index|lib)?(\.[mc]?js)?$/, '')
			.replace(/^\/?modules\//gi, '@')
			.replace(/^\//, '') || 'daemon'
		else return url
	}
}

export { default as _ } from 'lodash'