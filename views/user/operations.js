import User from 'lib/user.js'
import logger from 'lib/logger.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import statusCode from 'lib/status.code.js'
import { ConflictEntryError, EntryNotFoundError, PrivilegeError, OperationFailedError, InvalidOperationError, ChallengeFailedError } from 'lib/errors.js'
const appData = new AppData('user-profile'),
	appDataWithFs = new AppDataWithFs('user-profile'),
	/**
	 * The default successful response handler
	 * @param {import('express').Response} res
	 */
	successful = res => res.status(statusCode.Success.OK).end(),
	/**
	 * The default successful response handler
	 * @param {import('express').Response} res
	 */
	notFound = res => res.status(statusCode.ClientError.NotFound).end()
/**
 *
 * @param {String} userID
 * ID of the avatar owner
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function getUserAvatar(userID) {
	const fileDescriptor = await appDataWithFs.loadFile({ userID, url: '/avatar' })
	// No avatar belongs to the userID
	if (!fileDescriptor) return notFound
	else return res => fileDescriptor.pipe(res)
}
/**
 *
 * @param {User} currentUser
 * The user making this request
 * @param {String} userID
 * User ID string
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function viewUserProfile(currentUser, userID) {
	const targetUser = await User.locate(userID)
	if (!(targetUser instanceof User)) throw new EntryNotFoundError(
		`User <${userID}>`, { currentUser }
	)
	let content = await getRawUserProfile(userID),
		userProfile = { ...content, name: targetUser.name }
	// Check if mail is visible
	if (currentUser.hasPriv('VIEW_USER_EMAIL') || content.mailVisibility) {
		userProfile.mail = targetUser.mail
	}
	// Check if groups is visible
	userProfile.groups = (await currentUser.viewGroups(targetUser))
		.map(({ id, name }) => ({ id, name }))
	return userProfile
}
/**
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * request payload
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
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
						{ user }
					)
				}
				token = seed(6)
				let { acknowledged } = await appData.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
				if (acknowledged) {
					const link = `/updateMail?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
					try {
						await sendMail(mail, 'validateEmail', { link })
					} catch (e) {
						throw new OperationFailedError(
							`send mail to< ${mail}>`,
							{ user }
						)
					}
				} else {
					throw new OperationFailedError(
						`insert mail: <${mail}> and token: <${token}>`,
						{ user }
					)
				}
				// Return successful
				return successful
			}
		case 'UPDATE':
			if (await validateUpdateMailPayload(mail, token)){
				user.mail = mail
				await appData.delete({ mail, action: 'validate-mail' })
				return successful
			}
			break
		default:
			throw new InvalidOperationError(action, { user })
	}
}
/**
 *
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * Update payload
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function updateUserProfile(user, body) {
	try {
		if (body?.name) {
			user.name = body.name
			await user.update()
			delete body.name
		}
		await appData.store({ userID: user.userID },
			{ ...await getRawUserProfile(user.userID), ...body },
			{ replace: true }
		)
	} catch (e){
		throw new OperationFailedError(
			`update User <${user.userID}>'s profile`,
			{ user }
		)
	}
	return successful
}
/**
 *
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * Update payload
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function updateUserPassword(user, body) {
	const { oldPassword, newPassword } = body
	if (await user.login(oldPassword)){
		user.password = newPassword
		await user.update()
	} else throw new OperationFailedError(
		`check ${user}'s password`
	)
	return successful
}
/**
 *
 * @param {String} mail
 * User's email
 * @param {String} token
 * Token sent to user's mail
 * @returns {Boolean}
 */
async function validateUpdateMailPayload(mail, token) {
	const content = await appData.load({ mail, action: 'validate-mail' })
	if (!content || content.token !== token) {
		throw new ChallengeFailedError(
			`validate token <${token}> attached with mail <${mail}>`
		)
	}
	return true
}
/**
 *
 * @param {String} userID
 * UserID
 * @returns {Object }
 */
async function getRawUserProfile(userID) {
	return {
		mailVisibility: false,
		...await appData.load({ userID }) || {}
	}
}
