import User from 'lib/user.js'
import logger from 'lib/logger.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import statusCode from 'lib/status.code.js'
import { ConflictEntryError, EntryNotFoundError, PrivilegeError, OperationFailedError } from 'lib/errors.js'
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
 * @param {User} user
 * The user making this request
 * @param {(import('express').Response} res
 * Http response
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function getUserAvatar(userID, user, res) {
	return await new Promise((resolve, reject) => {
		appDataWithFs
			.loadFile({ userID, url: '/avatar' })
			.then(async fileDescriptor => {
				if (!fileDescriptor) reject(new EntryNotFoundError(
					`User<${userID}>'s avatar`,
					{ user }
				))
				logger.access(`Get User<${userID}>'s avatar <${fileDescriptor.fileID}>`)
				// Pipe file to res
				fileDescriptor.pipe(res)
			})
			.catch(e => {
				reject(new EntryNotFoundError(
					`User<${userID}>'s avatar`,
					{ user }
				))
			})
		resolve(successful)
	})
}
/**
 *
 * @param {User} currentUser
 * The user making this request
 * @param {String} uid
 * User ID string
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function viewUserProfile(currentUser, uid) {
	const targetUser = await User.locate(uid)
	if (!(targetUser instanceof User)) throw new EntryNotFoundError(
		`User <${uid}>`, { currentUser }
	)
	let content = await appData.load({ uid }) || {}
	let userProfile = Object.assign(content, { name: targetUser.name })
	// Check if mail is visible
	if (currentUser.hasPriv('VIEW_USER_EMAIL') || (await appData.load({ uid })).setting?.mailVisibility) {
		userProfile.mail = targetUser.mail
	}
	// Check if groups is visible
	userProfile.groups = (await currentUser.viewGroups(targetUser)).map(group => {
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
				return await new Promise((resolve, reject) => {
					token = seed(6)
					appData
						.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
						.then(async ({ acknowledged } = {}) => {
							if (acknowledged) {
								const link = `/updateMail?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
								try {
									await sendMail(mail, 'validateEmail', { link })
								} catch (e) {
									reject(new OperationFailedError(
										`send mail to< ${mail}>`,
										{ user }
									))
								}
							} else {
								reject(new OperationFailedError(
									`insert mail: <${mail}> and token: <${token}>`,
									{ user }
								))
							}
						})
					// Return successful
					resolve(successful)
				})
			}
		case 'UPDATE':
			if (validateUpdateMailPayload(mail, token)){
				user.mail = mail
				await appData.delete({ mail, action: 'validate-mail' })
				return successful
			}
			break
	}
}
/**
 *
 * @param {String} uid
 * Target userID
 * @param {Object} body
 * Update payload
 * @param {User} user
 * The user making this request
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function updateUserProfile(uid, body, user) {
	if (uid === user.userID){
		const { name } = body
		if (name) {
			user.name = name
			await user.update()
			delete body.name
		}
		let content = await appData.load({ uid }) || {}
		content = Object.assign(content, body)
		await appData.store({ uid },
			content,
			{ replace: true }
		)
	} else {
		throw new PrivilegeError(
			`update User<${uid}>'s profile`,
			{ user }
		)
	}
	return successful
}
/**
 *
 * @param {String} uid
 * Target userID
 * @param {Object} body
 * Update payload
 * @param {User} user
 * The user making this request
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function updateUserPassword(uid, body, user) {
	if (uid === user.userID){
		const {
			oldPassword,
			newPassword
		} = body
		if (await user.login(oldPassword)){
			user.password = newPassword
			await user.update()
		} else throw new OperationFailedError(
			`check ${user}'s password`
		)
	} else {
		throw new PrivilegeError(
			`update User<${uid}>'s profile`,
			{ user }
		)
	}
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
		throw new EntryNotFoundError(
			`token: <${token}>`,
			{ mail }
		)
	}
	return true
}
