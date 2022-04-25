import { strDistance } from 'utils/string.js'
import User from 'lib/user.js'
import { AppData } from 'lib/appData.js'
const appData = new AppData('user-profile')
export async function searchUserByID({ userIDs }, users = null) {
	if (!userIDs?.length) {
		return users
			? users
			: await User.db.user.find().project({ _id: 1, name: 1, groups: 1 }).toArray()
	} else {
		if (users) {
			return users.filter(user => {
				userIDs.includes(user._id)
			})
		} else {
			return await User.db.user.find({ _id: { $in: userIDs } }).project({ _id: 1, name: 1, groups: 1 }).toArray()
		}
	}
}
export async function searchUserByGroups({ groups }, users = null) {
	if (!groups?.length) {
		return users
			? users
			: await User.db.user.find().project({ _id: 1, name: 1, groups: 1 }).toArray()
	} else {
		if (users) {
			return users.filter(user =>
				groups.every(group => user.groups.includes(group))
			)
		} else {
			return await User.db.user.find({ groups: { $all: groups } }).project({ _id: 1, name: 1, groups: 1 }).toArray()
		}
	}
}
export async function searchUserByInstitution({ institutions }, users = null) {
	if (!institutions?.length) {
		return users
			? users
			: await User.db.user.find().project({ _id: 1, name: 1, groups: 1 }).toArray()
	} else {
		if (users) {
			for (let user of users) {
				user.institutionFilter = institutions.includes((await appData.load({ userID: user._id }))?.institution?._id)
			}
			return users.filter(user => user.institutionFilter)
		} else {
			return []
		}
	}
}
export async function sortUserByName({ userNames }, users = null) {
	if (!userNames?.length) {
		return users
			? users
			: await User.db.user.find().project({ _id: 1, name: 1, groups: 1 }).toArray()
	} else {
		if (users) {
			return users.sort((userA, userB) => {
				if (userNames && Array.isArray(userNames) && userNames.length) {
					let includedA = false, includedB = false,
						scoreA = userA.name?.length,
						scoreB = userB.name?.length
					userNames.forEach(name => {
						includedA ||= getScore(name, userA.name).included
						includedB ||= getScore(name, userB.name).included
						if (scoreA) scoreA = Math.min(scoreA, getScore(name, userA.name).distance)
						if (scoreB) scoreB = Math.min(scoreB, getScore(name, userB.name).distance)
					})
					if (includedA && includedB) return scoreA - scoreB
					if (includedA) return -1
					if (includedB) return 1
					return scoreA - scoreB
				}
				return userA._id.length - userB._id.length
			})
		} else {
			return []
		}
	}
}

function getScore(sourceStr, targetStr, limited = 50) {
	if (typeof sourceStr !== 'string') throw new TypeError(`A string is required but received a/an ${typeof sourceStr}`)
	if (typeof targetStr !== 'string') return { included: false, distance: limited }
	return { included: sourceStr.includes(targetStr), distance: strDistance(sourceStr, targetStr) }
}
