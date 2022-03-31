import { TODO } from 'lib/env'
import User from 'lib/user'
import logger from 'lib/logger.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import statusCode from 'lib/status.code.js'
import { ConflictEntryError, EntryNotFoundError, InvalidOperationError, OperationFailedError } from 'lib/errors.js'
const appData = new AppData('user-profile'),
	appDataWithFs = new AppDataWithFs('user-profile'),
	/**
	 * The default successful response handler
	 * @param {import('express').Response} res
	 */
	successful = res => res.status(statusCode.Success.OK).end()
/**
 *
 * @param {String} userID
 * ID of the avatar owner
 */
export async function getUserAvatar(userID) {
	appDataWithFs
		.loadFile({ userID, url: '/avatar' })
		.then(async fileDescriptor => {
			if (!fileDescriptor) throw new EntryNotFoundError(
				`User<${userID}>'s avatar`
			)
			// Pipe file to res
			logger.access(`Get User<${userID}>'s avatar <${fileDescriptor.fileID}>`)
			return res => fileDescriptor.pipe(res)
		})
		.catch(e => {
			throw new EntryNotFoundError(
				`User<${userID}>'s avatar`
			)
		})
}
/**
 *
 * @param {User} currentUser
 * @param {String} uid
 */
export async function viewUserProfile(currentUser, uid) {
	const targetUser = User.locate(uid)
	if (!(targetUser instanceof User)) throw new EntryNotFoundError(
		`User <${uid}>`, { currentUser }
	)
	// User's name and institution are visible to all users if exist.
	let userProfile = {
		name: targetUser.name,
		institution: targetUser.institution,
		signature: targetUser.signature
	}
	// Check if mail is visible
	if (currentUser.hasPriv('VIEW_USER_EMAIL') || (await appData.load({ uid })).mailVisibility) {
		userProfile.mail = targetUser.mail
	}
	// Check if groups is visible
	userProfile.groups = await currentUser.viewGroups(targetUser).map(group => {
		return {
			id: group.id,
			name: group.name
		}
	})
	return userProfile
}
/**
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * request payload
 */
export async function updateMail(user, body) {
	let {
		action,
		password,
		mail,
		token
	} = body
	mail = mail.toLowerCase()
	switch (action) {
		case 'VALIDATE':

			if (!await user.login(password)) {
				throw new OperationFailedError(
					`check ${user}'s password`
				)
			} else {
				if (await User.locate(mail)) {
					logger.verbose(`mail <${mail}> has already been registered`)
					throw new ConflictEntryError(
						'mail',
						mail,
						user
					)
				}
				token = seed(6)
				appData
					.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
					.then(async ({ acknowledged } = {}) => {
						if (acknowledged) {
							const link = `/updateMail?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
							try {
								return await sendMail(mail, 'validateEmail', { link })
							} catch (e) {
								throw new OperationFailedError(
									`send mail to< ${mail}>`,
									user
								)
							}
						} else {
							throw new OperationFailedError(
								`insert mail: <${mail}> and token: <${token}>`,
								user
							)
						}
					})
			}
			return successful
		case 'UPDATE':
			if (validateUpdateMailPayload(mail, token)){
				user.mail = mail
				await appData.delete({ mail, action: 'validate-mail' })
				return successful
			}
			break
	}
}
export async function updateUserProfile(req, res, next) {}
export async function updateUserPassword(req, res, next) {}
/**
 *
 * @param {String} mail
 * User's email
 * @param {String} token
 * Token sent to user's mail
 * @returns
 */
async function validateUpdateMailPayload(mail, token) {
	const content = await appData.load({ mail, action: 'validate-mail' })
	if (!content || content.token !== token) {
		throw new EntryNotFoundError(
			`token: <${token}>`,
			mail
		)
	}
	return true
}
