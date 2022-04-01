import { PrivilegeError, ConflictEntryError, EntryNotFoundError, InvalidOperationError, OperationFailedError } from 'lib/errors.js'
import Group, { RootSystemGroup, SystemGroup } from 'lib/groups.js'
import logger from 'lib/logger.js'
import { PRIV, PRIV_LUT } from 'lib/privileges.js'
import statusCode from 'lib/status.code.js'
/**
 * The default successful response handler
 * @param {import('express').Response} res
 */
const successful = res => res.status(statusCode.Success.OK).end()
/**
 * @param {import('lib/groups.js').GroupDescriptor} groupDsc
 * Group descriptor
 * @param {import('lib/user.js').default} user
 * The user making this request
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function create({ id, ...groupDsc }, user) {
	logger.info(`${user} creating Group <${id}> with ${JSON.stringify(groupDsc)}`)
	// Check user privilege
	if (
		!user.hasPriv(PRIV.ALTER_USER_GROUP)
		|| !user.hasPriv(PRIV.ALTER_GROUP_PRIVILEGES)
	) throw new PrivilegeError(`create Group <${id}>`, { user })
	// Check if group exists
	let existingGroup = await Group.locate(id)
	if (existingGroup instanceof Group) throw new ConflictEntryError(
		existingGroup, `Group <${id}>`, { user }
	)
	// Challenge group privileges against the user
	if (!Group.challenge(groupDsc, user)) throw new PrivilegeError(
		`create Group <${id}> with privileges ${groupDsc.privileges.join(', ')}`,
		{ user }
	)
	// Create the group
	await new Group(id, groupDsc).update()
	return successful
}
/**
 * @param {import('lib/groups.js').GroupDescriptor} groupDsc
 * Group descriptor to be updated, all fields in dsc must exist
 * @param {import('lib/user.js').default} user
 * The user making this request
 * @returns {(import('express').Response) => undefined}
 * The handler function to send the response
 */
export async function update({ id, ...groupDsc }, user) {
	logger.info(`${user} updating Group <${id}> with ${JSON.stringify(groupDsc)}`)
	const group = await Group.locate(id)
	// Check the existence of the group
	if (!(group instanceof Group)) throw new EntryNotFoundError(
		`Group <${id}>`, { user }
	)
	// Check if user has privilege to update this group
	if (!group.challenge(user)) throw new PrivilegeError(
		`update ${group}`, { user }
	)
	// Strip privileges if updating root group
	if (!(group instanceof RootSystemGroup)) delete groupDsc.privileges
	// Check if user has privileges specified in groupDsc.privileges
	if (!Group.challenge(groupDsc, user)) throw new PrivilegeError(
		`alter ${group}'s privileges to ${groupDsc.privileges.join(', ')}`, { user }
	)
	await group.update({ $set: groupDsc })
	return successful
}

export async function remove({ id }, user) {
	logger.info(`${user} removing Group <${id}>`)
	const group = await Group.locate(id)
	// Check the existence of the group
	if (!(group instanceof Group)) throw new EntryNotFoundError(`Group <${id}>`, { user })
	if (group instanceof SystemGroup) throw new InvalidOperationError(`remove ${group}`, { user })
	// Check if user has privilege to update this group
	if (!group.challenge(user)) throw new PrivilegeError(
		`remove ${group} which is superior to himself`, { user }
	)
	if (await group.remove()) return successful
	else throw new OperationFailedError(`remove ${group}`, { user })
}
