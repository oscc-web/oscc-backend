// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res('groups')]: {},
	[res('auth')]: {},
	[res('user')]: {},
	[res('institution')]: {},
	[res('searchUser')]: {},
	...await res.$('helper')
}
