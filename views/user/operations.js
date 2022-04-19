import User, { GuestUser } from 'lib/user.js'
import { AppData } from 'lib/appData.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { seed } from 'utils/crypto.js'
import { sendMail } from '../../modules/mailer/lib.js'
import statusCode from 'lib/status.code.js'
import { checkLocaleKey, findOrgsByID } from 'utils/searchOrgs.js'
import { ConflictEntryError, EntryNotFoundError, PrivilegeError, OperationFailedError, InvalidOperationError, ChallengeFailedError, BadRequestError } from 'lib/errors.js'
import { PRIV } from 'lib/privileges.js'
import Group from 'lib/groups.js'
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
 * @param {String} [fileID]
 * ID of the avatar file
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 */
export async function getAvatar(userID, [fileID]) {
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
	const profile = await getRawUserProfile(userID),
		PRIV_ALTER_USER_INFO = await currentUser.hasPriv(PRIV.ALTER_USER_INFO),
		isSameUser = currentUser.userID === userID,
		{ name } = targetUser,
		editable = {
			name: isSameUser || PRIV_ALTER_USER_INFO,
			mail: isSameUser || PRIV_ALTER_USER_INFO,
			inst: isSameUser || PRIV_ALTER_USER_INFO,
			avatar: isSameUser || PRIV_ALTER_USER_INFO,
			groups: await currentUser.hasPriv(PRIV.ALTER_USER_GROUP),
			preferences: isSameUser || PRIV_ALTER_USER_INFO
		}
	// Check if mail is visible
	if (
		await currentUser.hasPriv(PRIV.VIEW_USER_EMAIL)
		|| profile.mailVisibility
		|| editable.mail
	) {
		profile.mail = targetUser.mail
	}
	// Check if institution is visible
	if (
		!await currentUser.hasPriv(PRIV.VIEW_USER_INSTITUTION)
		&& !profile.instVisibility
		&& !editable.inst
	) {
		delete profile.institution
	}
	// Check if groups is visible
	const groups = (await currentUser.viewGroups(targetUser)).map(({ id, name }) => ({ id, name }))
	return { ...profile, editable, groups, name }
}
/**
 * @param {{
 * action: 'CHALLENGE' | 'UPDATE',
 * password: String | undefined,
 * token: String | undefined,
 * mail: String
 * }} body
 * @param {User} operatingUser
 * The user making this request
 * @param {User} targetUser
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 * @throws {ChallengeFailedError|ConflictEntryError|OperationFailedError|InvalidOperationError}
 */
export async function updateMail({ action, password, token, mail }, operatingUser, targetUser) {
	if (operatingUser.userID !== targetUser.userID && !await operatingUser.hasPriv(PRIV.ALTER_USER_INFO)) {
		throw new PrivilegeError(
			'update other\'s mail',
			{ operatingUser }
		)
	}
	mail = mail.toLowerCase()
	switch (action) {
		case 'CHALLENGE': {
			// Challenge user password
			if (!await targetUser.login(password)) throw new ChallengeFailedError(
				'challenge own password', { targetUser }
			)
			// Check if mail has already been used/registered
			const existingUser = await User.locate(mail)
			if (existingUser instanceof User) throw new ConflictEntryError(
				existingUser, `User <${mail}>`, { targetUser }
			)
			// Generate one-time token for mail validation
			const token = seed(6)
			let { acknowledged } = await appData.store({ mail, action: 'validate-mail' }, { token }, { replace: true })
			if (acknowledged) {
				const { userID, name } = targetUser,
					link = `/actions/reset-mail/${userID}?token=${token}&mail=${Buffer.from(mail).toString('base64')}&userID=`
				// 'sendMail()' may throw error on failed IPC call.
				// This will be handled as internal server error,
				// and the details should not be sent to client.
				await sendMail(mail, 'resetEmail', { link, userID, name })
			} else throw new OperationFailedError(
				`save mail '${mail}' and token '${token}' to tmpAppData`,
				{ targetUser }
			)
			return successful
		}
		case 'UPDATE': {
			await challengeUpdateMailPayload(mail, token)
			// Update user's mail record
			targetUser.mail = mail
			// Check if mail has been updated correctly
			if (await targetUser.mail !== mail) throw new OperationFailedError(
				`update mail from ${targetUser.mail} to ${mail}`, { targetUser }
			)
			// Remove challenge record
			await appData.delete({ mail, action: 'validate-mail' })
			return successful
		}
		default:
			throw new InvalidOperationError(action, { targetUser })
	}
}
/**
 * @param {{
 * name: String | undefined
 * profile: Object
 * }} body
 * @param {User} operatingUser
 * The user making this request
 * @param {User} targetUser
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 */
export async function updateProfile({ name, ...profile }, operatingUser, targetUser) {
	if (operatingUser.userID !== targetUser.userID && !await operatingUser.hasPriv(PRIV.ALTER_USER_INFO)) {
		throw new PrivilegeError(
			'update other\'s profile',
			{ operatingUser }
		)
	}
	if (name) {
		targetUser.name = name
		await targetUser.update()
	}
	delete profile.institution
	// Expects OperationFailedError thrown from appData.store
	await appData.store({ userID: targetUser.userID },
		{ ...await getRawUserProfile(targetUser.userID), ...profile },
		{ replace: true }
	)
	return successful
}
/**
 * @param {{
 * oldPassword: String,
 * newPassword: String
 * }} body
 * @param {User} user
 * The user making this request
 * @returns {Promise<(import('express').Response) => undefined>}
 * The handler function to send the response
 * @throws {ChallengeFailedError|OperationFailedError}
 */
export async function updatePassword({ oldPassword, newPassword }, operatingUser, targetUser) {
	if (operatingUser.userID !== targetUser.userID && !await operatingUser.hasPriv(PRIV.ALTER_USER_INFO)) {
		throw new PrivilegeError(
			'update other\'s password',
			{ operatingUser }
		)
	}
	if (!await targetUser.login(oldPassword)) throw new ChallengeFailedError(
		'challenge own password', { targetUser }
	)
	// Update user password, db update will be automatically triggered
	targetUser.password = newPassword
	// Check if uew password takes effect
	if (!await targetUser.login(newPassword)) throw new OperationFailedError(
		'update own password', { targetUser }
	)
	return successful
}
/**
 * @param {{
 * override: Boolean,
 * ID: String | undefined,
 * name: String | Object | undefined
 * }} body
 * @param {User} operatingUser
 * The user making this request
 * @param {User} targetUser
 * @returns {Promise<(import('express').Response) => undefined>}
 * @throws {InvalidOperationError|EntryNotFoundError}
 */
export async function updateInstitution({ override, ID, name }, operatingUser, targetUser) {
	if (operatingUser.userID !== targetUser.userID && !await operatingUser.hasPriv(PRIV.ALTER_USER_INFO)) {
		throw new PrivilegeError(
			'update other\'s institution',
			{ operatingUser }
		)
	}
	// Override is true
	if (override) {
		// Check name and update user's institution
		if (name = await checkLocaleKey(name)) {
			await updateUserInstitution(targetUser.userID, { ID, name })
		// Name is invalid
		} else throw new InvalidOperationError(
			`check name ${name}`,
			targetUser.userID
		)
	// Override is false
	} else {
		if (!ID && typeof ID !== 'string') throw new InvalidOperationError(
			`update User ${targetUser}'s institution, ID is not valid`
		)
		ID = ID.trim().toLowerCase()
		let result = await findOrgsByID(ID)
		if (!result) throw new EntryNotFoundError(
			`institution ID: <${ID}>`,
			{ targetUser }
		)
		await updateUserInstitution(targetUser.userID, result)
	}
	return successful
}
/**
 * @param {User} operatingUser
 * The user making this request
 * @param {User} targetUser
 * The user to be updated
 * @param {{
 * add: String[],
 * sub: String[]
 * }} body
 * Update payload
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function updateGroups(operatingUser, targetUser, { add = [], sub = [] } = {}) {
	const groups = await Promise.all([...add, ...sub].map(
		async groupID => await Group.locate(groupID) || groupID
	))
	// Check if user has sufficient privileges
	for (const group of groups) {
		if (!(group instanceof Group)) throw EntryNotFoundError(
			`Group <${group}>`,
			{ user: operatingUser }
		)
		if (!group.challenge(operatingUser)) throw new PrivilegeError(
			`update groups of ${targetUser}`, { user: operatingUser }
		)
	}
	// Do the update
	await targetUser.update({ $push: { groups: { $each: add } } })
	for (const groupID of sub) {
		await targetUser.update({ $pull: { groups: groupID } })
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
		instVisibility: false,
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
