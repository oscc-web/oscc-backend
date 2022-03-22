import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
global.getResolver = ({ url }) => {
	const DIR = dirname(url.replace(/^\w+:\/\//gi, ''))
	return Object.assign(function manifestResolver(itemName = '') {
		const path = resolve(DIR, itemName)
		for (const suffix of ['', '.js', '.cjs', '.mjs']) {
			if (existsSync(path + suffix)) return path + suffix
		}
		throw new Error(`Unable to resolve item ${path}`)
	}, {
		async $(path, manifest = 'manifest.js') {
			console.log(resolve(DIR, path, manifest))
			return (await import(resolve(DIR, path, manifest))).default
		}
	})
}
// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Export the manifest
export default {
	...await res.$('router'),
	...await res.$('modules'),
	...await res.$('views'),
}