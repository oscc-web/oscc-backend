import { PrivilegeError } from 'lib/errors.js'
import Group, { SystemGroup } from 'lib/groups.js'
import { PRIV, PRIV_LUT } from 'lib/privileges.js'
export default async function getGroupsList(user) {
	if (!user.hasPriv(PRIV.ALTER_USER_GROUP)) throw new PrivilegeError(
		'get list of all groups', { user }
	)
	return (await Group.list)
		.filter(group => group.challenge(user))
		.map(group => {
			const { id, name, visibility, privileges } = group
			return {
				id,
				name,
				visibility,
				privileges: privileges
					.filter(user.hasPriv.bind(user))
					.map(p => PRIV_LUT[p]),
				system: group instanceof SystemGroup
			}
		})
}
