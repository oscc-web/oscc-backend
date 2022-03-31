// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res('groups')]: {},
	...await res.$('helper')
}
