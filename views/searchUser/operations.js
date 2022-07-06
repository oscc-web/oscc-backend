import { strDistance } from 'utils/string.js'
import User from 'lib/user.js'
import { AppData } from 'lib/appData.js'
import logger from 'lib/logger.js'
const appData = new AppData('user-profile')
/**
 * Match a user according to userID
 * @param {import('lib/user').User} user User instance
 * @param {string[]} idList List of userID's to be matched
 * @returns {number}
 * 0 for no match,
 * 100 for exact match,
 * 1-99 if partially matched (depending on string distance)
 */
export async function userID(user, idList) {
	const
		target = user.userID,
		result = idList.map(
			str => 100 - strDistance(target, str, {
				normalize: 100,
				// Replacements are not allowed
				REPLACE: Infinity,
				INSERT: 2,
				DELETE: Infinity,
				CASE: 1
			})
		)
	logger.debug(
		`Matching ${user} with idList ${JSON.stringify(idList)}`
		+ `[result: ${result}]`
	)
	return Math.max(0, ...result)
}
/**
 * Match a user according to user's name
 * @param {import('lib/user').User} user User instance
 * @param {string[]} idList List of userID's to be matched
 * @returns {number}
 * 0 for no match,
 * 100 for exact match,
 * 1-99 if partially matched (depending on string distance)
 */
export async function name(user, nameList = null) {
	// Ensure nameList is a valid and not-empty array
	if (!Array.isArray(nameList) || !nameList.length) return 0
	const
		target = user.name,
		result = nameList.map(str => {
			return 100 - strDistance(target, str, {
				normalize: 100,
				// Replacements are not allowed
				REPLACE: Infinity,
				INSERT: 2,
				DELETE: Infinity,
				CASE: 1
			})
		})
	logger.debug(
		`Matching ${user} with nameList ${JSON.stringify(nameList)}`
		+ `[result: ${result}]`
	)
	return Math.max(0, ...result)
}
/**
 * Match a user according to his/her user groups
 * @param {import('lib/user').User} user User instance
 * @param {string[]} gidList List of userID's to be matched
 * @param {boolean} MATCH_ALL Flag indicating if matches all groups
 * @returns {number} 0 if not match, 100 if match
 */
export async function groups(user, gidList = null, MATCH_ALL = true) {
	// Ensure gidList is a valid and not-empty array
	if (!Array.isArray(gidList) || !gidList.length) return 0
	// Counter of matched gid's
	let matchCount = 0
	await user.groups
	for (const gid of gidList) {
		let flagMatched = false
		for (const group of user.groups) {
			if (group.id === gid) {
				flagMatched = true
				matchCount++
				break
			}
		}
		if (!flagMatched && MATCH_ALL) {
			matchCount = 0
			break
		}
	}
	logger.debug(JSON.stringify({
		Matching: `${user}`,
		list: JSON.stringify(gidList),
		matchCount
	}))
	return matchCount && Math.ceil(matchCount / gidList.length)
}
/**
 * Match a user whose groups contains ALL listed gid's
 * @param {import('lib/user').User} user User instance
 * @param {string[]} gidList List of userID's to be matched
 * @returns {number} 0 if not match, 100 if match
 */
export function groups_all(user, gidList) {
	return groups(user, gidList, true)
}
/**
 * Match a user whose groups contains ANY listed gid's
 * @param {import('lib/user').User} user User instance
 * @param {string[]} gidList List of userID's to be matched
 * @returns {number} 0 if not match, 100 if match
 */
export function groups_any(user, gidList) {
	return groups(user, gidList, false)
}
/**
 * Match a user whose groups contains ANY listed gid's
 * @param {import('lib/user').User} user User instance
 * @param {string[]} instList List of userID's to be matched
 * @returns {number} 0 if not match, 100 if match
 */
export async function institution(user, instList = null) {
	// Ensure instList is a valid and not-empty array
	if (!Array.isArray(instList) || !instList.length) return 0
	// Load and extract user institution from user profile
	const userInstitution = (await appData.load({ userID: user._id }))?.institution?._id
	// Return match result
	return userInstitution && instList.includes(userInstitution)
		? 100
		: 0
}
