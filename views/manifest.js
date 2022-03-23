// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	...await res.$('utilities')
}