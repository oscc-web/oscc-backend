import { TODO } from 'lib/env'
import User from 'lib/user'
import statusCode from 'lib/status.code.js'
export async function updateUserProfile(req, res, next) {}
/**
 * @param {(import('express').Request)} req
 * @param {(import('express').Response)} res
 * @param {(import('express').NextFunction)} next
 * @returns {(import('express').NextFunction)}
 */
export async function viewUserProfile(req, res, next) {
	const { session } = req,
		currentUser = await session.user,
		userID = req?.userID,
		targetUser = await User.locate(userID)
	// User's name and institution are visible to all users if exist.
	let userProfile = {
		name: targetUser.name,
		institution: targetUser.institution,
		signature: targetUser.signature
	}
	// Check if mail is visible
	if (currentUser.hasPriv('VIEW_USER_EMAIL') || TODO('targetUser\'s mail is granted')) {
		userProfile.mail = targetUser.mail
	}
	// Check if groups is visible
	userProfile.groups = (await targetUser.groups).filter(group =>
		group.visibility === 'ALL'
			// Self: currentUser is targetUser
			|| group.visibility === 'SELF' && currentUser.userID === targetUser.userID
			// SAME-Group: currentUser and targetUser are in the the same group
			|| group.visibility === 'SAME-GROUP' && group in currentUser.groups
	).map(group => {
		return {
			id: group.id,
			name: group.name
		}
	})
	res.status(statusCode.Success.OK).end(JSON.stringify(userProfile))
	return next()
}
