import User, { GuestUser } from 'lib/user.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import statusCode from 'lib/status.code.js'
import { ConflictEntryError, EntryNotFoundError, PrivilegeError, OperationFailedError, InvalidOperationError, ChallengeFailedError } from 'lib/errors.js'
import { checkLocaleKey, findOrgsByID } from 'utils/searchOrgs.js'
const appData = new AppData('user-profile'),
	appDataWithFs = new AppDataWithFs('user-profile'),
	/**
	 * The default successful response handler
	 * @type {(res: import('express').Response) => Any}
	 */
	successful = res => res.status(statusCode.Success.OK).end(),
	/**
	 * The default successful response handler
	 * @type {(res: import('express').Response) => Any}
	 */
	notFound = res => res.status(statusCode.ClientError.NotFound).end()
/**
 *
 * @param {String} userID
 * ID of the avatar owner
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 */
export async function getUserAvatar(userID, [fileID]) {
	const fd = await appDataWithFs.loadFile({ userID, url: '/avatar' })
	// No avatar belongs to the userID
	if (!fd) return notFound
	// Cache friendly redirect
	if (fd.fileID === fileID) return res => {
		res.set('Cache-Control', 'public')
		fd.pipe(res)
	}
	else return res => res
		.set('Cache-Control', 'no-store')
		.redirect(`./avatar?${fd.fileID}`)
}
/**
 *
 * @param {User} currentUser
 * The user making this request
 * @param {String} userID
 * User ID string
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 * @throws {EntryNotFoundError}
 */
export async function viewUserProfile(currentUser = new GuestUser, userID) {
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
	userProfile.groups = (await currentUser.viewGroups(targetUser)).map(
		({ id, name }) => ({ id, name })
	)
	return userProfile
}
/**
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * request payload
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 * @throws {ChallengeFailedError|ConflictEntryError|OperationFailedError|InvalidOperationError}
 */
export async function updateMail(user, body) {
	const {
			action,
			password,
			token
		} = body,
		mail = body.mail.toLowerCase()
	switch (action) {
		case 'CHALLENGE': {
			// Challenge user password
			if (!await user.login(password)) throw new ChallengeFailedError(
				'challenge own password', { user }
			)
			// Check if mail has already been used/registered
			const existingUser = await User.locate(mail)
			if (existingUser instanceof User) throw new ConflictEntryError(
				existingUser, `User <${mail}>`, { user }
			)
			// Generate one-time token for mail validation
			const token = seed(6)
			let { acknowledged } = await appData.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
			if (acknowledged) {
				const link = `/settings/update-mail?token=${token}&mail=${Buffer.from(mail).toString('base64')}`
				// 'sendMail()' may throw error on failed IPC call.
				// This will be handled as internal server error,
				// and the details should not be sent to client.
				await sendMail(mail, 'validateEmailChange', { link })
			} else throw new OperationFailedError(
				`save mail '${mail}' and token '${token}' to tmpAppData`,
				{ user }
			)
			return successful
		}
		case 'UPDATE': {
			await challengeUpdateMailPayload(mail, token)
			// Update user's mail record
			user.mail = mail
			// Check if mail has been updated correctly
			if (await user.mail !== mail) throw new OperationFailedError(
				`update mail from ${user.mail} to ${mail}`, { user }
			)
			// Remove challenge record
			await appData.delete({ mail, action: 'validate-mail' })
			return successful
		}
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
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 */
export async function updateUserProfile(user, body) {
	if (body?.name) {
		user.name = body.name
		await user.update()
		delete body.name
	}
	// Expects OperationFailedError thrown from appData.store
	await appData.store({ userID: user.userID },
		{ ...await getRawUserProfile(user.userID), ...body },
		{ replace: true }
	)
	return successful
}
/**
 *
 * @param {User} user
 * The user making this request
 * @param {Object} body
 * Update payload
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 * @throws {ChallengeFailedError|OperationFailedError}
 */
export async function updateUserPassword(user, body) {
	const { oldPassword, newPassword } = body
	if (!await user.login(oldPassword)) throw new ChallengeFailedError(
		'challenge own password', { user }
	)
	// Update user password, db update will be automatically triggered
	user.password = newPassword
	// Check if uew password takes effect
	if (!await user.login(newPassword)) throw new OperationFailedError(
		'update own password', { user }
	)
	return successful
}
/**
 *
 * @param {String} userID
 * The ID of user making this request
 * @param {Object} body
 * Update payload
 * @returns {Promise<(import('express').Response) => undefined>}
 * @throws {InvalidOperationError|EntryNotFoundError}
 */
export async function updateInstitution(userID, body) {
	let { override, ID, name } = body
	// Override is true
	if (override) {
		// Check name and update user's institution
		if (name = await checkLocaleKey(name)) {
			await updateUserInstitution(userID, { ID, name })
		// Name is invalid
		} else throw new InvalidOperationError(
			`check name ${name}`,
			userID
		)
	// Override is false
	} else {
		if (!ID && typeof ID === 'string') throw new InvalidOperationError(
			`update User <${userID}>'s institution, ID is not valid`
		)
		ID = ID.trim().toLowerCase()
		let result = await findOrgsByID(ID)
		if (!result) throw new EntryNotFoundError(
			`institution ID: <${ID}>`,
			{ userID }
		)
		await updateUserInstitution(userID, result)
	}
	return successful
}
/**
 * @param {String} mail
 * User's email
 * @param {String} token
 * Token sent to user's mail
 * @throws {ChallengeFailedError}
 */
async function challengeUpdateMailPayload(mail, token) {
	const content = await appData.load({ mail, action: 'validate-mail' })
	if (
		!content || content.token !== token
	) throw new ChallengeFailedError(
		`validate token <${token}> attached with mail <${mail}>`
	)
}
/**
 *
 * @param {String} userID
 * UserID
 * @returns {Promise<Object>}
 */
async function getRawUserProfile(userID) {
	return {
		mailVisibility: false,
		...await appData.load({ userID }) || {}
	}
}
/**
 * Update Institution in appData
 * @param {String} userID
 * user ID
 * @param {Object} institution
 * institution object
 * @returns {Promise<import('mongodb').InsertOneResult | Promise<import('mongodb').UpdateResult>}
 */
async function updateUserInstitution(userID, institution) {
	institution = await findOrgsByID(institution.ID)
		? await findOrgsByID(institution.ID)
		: institution
	return await appData.store({ userID },
		{ ...await getRawUserProfile(userID), institution },
		{ replace: true }
	)
}
