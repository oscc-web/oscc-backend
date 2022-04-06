import { PROJECT_ROOT } from 'lib/env.js'
import { readFileSync } from 'fs'
const path = `${PROJECT_ROOT}/var/orgList.json`
export const orgs = JSON.parse(readFileSync(path))
/**
 * Find institutions in orgs which contains given string and sorted by length of orgs ID
 * @param {Object} body
 * Search payload
 * @returns {Object[]}
 * Orgs including name
 */
export async function searchOrgs(searchString) {
	searchString = searchString.trim().toLowerCase()
	return Object
		.entries(orgs)
		.map(([ID, el]) => ({ ID, ...el }))
		.filter(org =>
			include(org.ID, searchString) || include(org.name, searchString)
		).sort((orgA, orgB) =>
			orgA.ID.length - orgB.ID.length
		)
}
/**
 * Check if given String exists in source
 * @param {String | Object} source
 * Payload
 * @param {String} str
 * Search string
 * @returns {Boolean}
 * true for str is contained in source
 * false for str is not contained in source
 */
function include(source, str){
	if (typeof str !== 'string') throw new TypeError(`A string is required but received a/an ${typeof str}`)
	if (typeof source === 'string') {
		return source.toLowerCase().includes(str)
	} else if (typeof source === 'object') {
		for (const val of Object.values(source)) if (include(val, str)) return true
	}
	return false
}
/**
 * Check name is valid.If valid returns trimmed value, if not returns null
 * @param {String | Object} name
 * @returns {String | Object}
 */
export async function checkLocaleKey(name) {
	const regex = /^[a-z]{2}(-[A-Z]{2})?$/
	if (typeof name === 'string' && name.trim()) return name.trim()
	if (typeof name === 'object') {
		for (const key in name) {
			if (key && key.trim() && regex.test(key)) {
				if (name[key] && name[key].trim()) name[key] = name[key].trim()
				else return null
			} else return null
		}
		return name
	}
	return null
}
