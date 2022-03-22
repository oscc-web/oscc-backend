// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	// [pwd('user')]: { cluster: 2 },
	...res.$('utilities')
}