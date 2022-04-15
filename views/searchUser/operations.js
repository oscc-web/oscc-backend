import { strDistance } from 'utils/string.js'
import User from 'lib/user.js'
import { AppData } from 'lib/appData.js'
const appData = new AppData('user-profile')

export async function searchUser({ userIDs, userNames, groups, institutions }) {
	// Mongodb query
	let query = {}
	// UserID filter
	if (userIDs && Array.isArray(userIDs) && userIDs.length) {
		query._id = { $in: userIDs }
	}
	// Groups filter
	if (groups && Array.isArray(groups) && groups.length) {
		query.groups = { $all: groups }
	}
	let users = await User.db.user.find(query).project({ _id: 1, name: 1, groups: 1 }).toArray()
	let existInstitutions = false,
		existNames = false
	if (institutions && Array.isArray(institutions) && institutions.length) {
		existInstitutions = true
	}
	if (userNames && Array.isArray(userNames) && userNames.length) {
		existNames = true
	}
	for (let user of users) {
		if (existInstitutions){
			user.institutionFilter = institutions.includes((await appData.load({ userID: user._id }))?.institution?._id)
		} else 	user.institutionFilter = true
	}
	return users
		.filter(user =>
			user.institutionFilter
		).sort((userA, userB) => {
			if (existNames) {
				let includedA = false, includedB = false,
					scoreA = userA.name?.length,
					scoreB = userB.name?.length
				userNames.forEach(name => {
					includedA ||= getScore(name, userA.name).included
					includedB ||= getScore(name, userB.name).included
					if (scoreA) scoreA = Math.min(scoreA, getScore(name, userA.name).distance)
					if (scoreB) scoreB = Math.min(scoreB, getScore(name, userB.name).distance)
					if (includedA && includedB) return scoreA - scoreB
					if (includedA) return -1
					if (includedB) return 1
					return scoreA - scoreB
				})
			}
			return userA._id.length - userB._id.length
		})
		.map(user => ({ ID: user._id }))
}

function getScore(sourceStr, targetStr, limited = 50) {
	if (typeof sourceStr !== 'string') throw new TypeError(`A string is required but received a/an ${typeof sourceStr}`)
	if (typeof targetStr !== 'string') return { included: false, distance: limited }
	return { included: sourceStr.includes(targetStr), distance: strDistance(sourceStr, targetStr) }
}
