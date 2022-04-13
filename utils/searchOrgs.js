import { PROJECT_ROOT } from 'lib/env.js'
import { readFileSync, writeFileSync } from 'fs'
import dbInit from './mongo.js'
import { strDistance } from './strDistance.js'
const path = `${PROJECT_ROOT}/var/orgList.json`
let orgs = JSON.parse(readFileSync(path))
export async function loadOrgs() {
	const db = dbInit('orgs/c')
	Object
		.entries(orgs)
		.map(([_id, el]) => ({ _id, ...el }))
		.forEach(async org => {
			await db.orgs.insert(org)
		})
}
export async function dumpOrgs() {
	const db = dbInit('orgs/r')
	orgs = Object.fromEntries(await (await db.orgs.find())
		.toArray()
		.map(({ _id, ...el }) => [_id, el]))
	writeFileSync(path, JSON.stringify(orgs))
}
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
			Math.min(getScore(org.ID, searchString), getScore(org.name, searchString)) < 50
		).sort((orgA, orgB) =>
			Math.min(getScore(orgA.ID, searchString), getScore(orgA.name, searchString)) - Math.min(getScore(orgB.ID, searchString), getScore(orgB.name, searchString))
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
function getScore(source, str){
	const max = 50
	if (typeof str !== 'string') throw new TypeError(`A string is required but received a/an ${typeof str}`)
	if (typeof source === 'string') {
		if (source.toLowerCase().includes(str)) return strDistance(source.toLowerCase(), str) - max
		return strDistance(source.toLowerCase(), str)
	} else if (typeof source === 'object') {
		let min = max
		for (const val of Object.values(source)) {
			min = getScore(val, str) < min ? getScore(val, str) : min
		}
		return min
	}
	return max
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
export async function findOrgsByID(_id) {
	if (!_id) return null
	const db = dbInit('orgs/r')
	return (await (await db.orgs.find({ _id })).toArray())[0]
}
