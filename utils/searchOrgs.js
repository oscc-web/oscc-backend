import { PROJECT_ROOT } from 'lib/env.js'
import { readFileSync, writeFileSync } from 'fs'
import dbInit from './mongo.js'
import { strDistance } from './string.js'
const path = `${PROJECT_ROOT}/var/orgList.json`
export async function loadOrgs() {
	const db = dbInit('orgs/c')
	Object
		.entries(JSON.parse(readFileSync(path)))
		.map(([_id, el]) => ({ _id, ...el }))
		.forEach(async org => {
			await db.orgs.insert(org)
		})
}
export async function dumpOrgs() {
	const db = dbInit('orgs/r')
	writeFileSync(path, JSON.stringify(
		Object.fromEntries(await (await db.orgs.find())
			.toArray()
			.map(({ _id, ...el }) => [_id, el]))
	))
}
/**
 * Find institutions in orgs which contains given string and sorted by length of orgs ID
 * @param {Object} body
 * Search payload
 * @returns {Object[]}
 * Orgs including name
 */
export const searchOrgs = await (async () => {
	const db = dbInit('orgs/r')
	return async searchString => {
		searchString = searchString.trim().toLowerCase()
		return (await db.orgs
			.find({})
			.toArray())
			.map(org => {
				org.score = {
					included: getScore(org._id, searchString).included || getScore(org.name, searchString).included,
					distance: Math.min(getScore(org._id, searchString).distance, getScore(org.name, searchString).distance)
				}
				return org
			})
			.filter(org =>
				org.score.included || org.score.distance < 50
			).sort((orgA, orgB) => {
				if (orgA.score.included && orgB.score.included) return orgA.score.distance - orgB.score.distance
				if (orgA.score.included) return -1
				if (orgB.score.included) return 1
				return orgA.score.distance - orgB.score.distance
			})
	}
})()
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
function include(source, str) {
	if (typeof str !== 'string') throw new TypeError(`A string is required but received a/an ${typeof str}`)
	if (typeof source === 'string') {
		return source.toLowerCase().includes(str)
	} else if (typeof source === 'object') {
		for (const val of Object.values(source)) if (include(val, str)) return true
	}
	return false
}
function getScore(source, str, limited = 50) {
	if (typeof str !== 'string') throw new TypeError(`A string is required but received a/an ${typeof str}`)
	if (typeof source === 'string') {
		return { included: source.toLowerCase().includes(str), distance: strDistance(source.toLowerCase(), str) }
	} else if (typeof source === 'object') {
		let min = limited, included = false
		for (const val of Object.values(source)) {
			// Min = getScore(val, str).distance < min ? getScore(val, str).distance : min
			let score = getScore(val, str, limited)
			min = Math.min(score.distance, min)
			included ||= score.included
		}
		return { included, distance: min }
	}
	return { included: false, distance: limited }
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
export const findOrgsByID = await (async function() {
	const db = await dbInit('orgs/r')
	return async _id => {
		if (!_id) return null
		return (await (await db.orgs.find({ _id })).toArray())[0]
	}
})()
