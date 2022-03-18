import { PRIV } from '../../lib/privileges.js'
export default {
	'/avatar': {
		duplicate: false,
		replace: true
	},
	'/resume': {
		privilege: PRIV.ALTER_GROUP_PRIVILEGES
	}
}