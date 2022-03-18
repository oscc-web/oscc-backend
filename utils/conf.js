/**
 * Backend Service Configuration
 * @typedef {Object} Config
 * @property {'development' | 'production'} mode
 * @property {'ysyx.org' | 'ysyx.local' | 'ysyx.dev' | 'ysyx.cc' | 'ysyx.oscc.cc'} domain
 * @property {import('./mongo.js').mongoConfig} mongo
 * @property {portConfig} port
 * @property {import('../modules/mailer/index.js').mailerConfig} mailer
 * @property {Number} [processRestartCoolDownPeriodMs=60000]
 * Minimum time interval to restart an unexpectedly exited process
 * If a process repeatedly exits, an error will be fired, and that process remains dead
 */

/**
 * @typedef {Object} portConfig
 * @property {Number} [vite=3000] Vite dev server port (Only used in dev mode)
 * @property {Number} [router=8000]
 * @property {Number} [deploy=8999]
 * @property {Number} [mailer=8998]
 * @property {Number} [survey=8001]
 * @property {Number} [NodeBB=4567]
 */

/**
 * Wrapper function to enable config syntax highlighting.
 * @param {Config} conf 
 * @returns {Config}
 */
export function defineConfig(conf) {
	return conf
}
/**
 * Compose config object from multiple sources
 * @returns {Promise<Config>}
 */
export async function composeConfig(path) {
	const fs = (await import('fs')).default
	if (fs.existsSync(`${path}/config.json`)) {
		return JSON.parse(
			fs.readFileSync(`${path}/config.json`)
		)
	}
	// Try to extract configurations from config.js (ESM)
	for (const suffix of ['js', 'mjs']) {
		if (fs.existsSync(`${path}/config.${suffix}`)) {
			return (await import(`${path}/config.${suffix}`)).default
		}
	}
	// No config file found, throw error and terminate execution
	console.error(`No configuration file found in ${path}, aborting...`)
	process.exit(1)
}