// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res('institutions')]: { cluster: 2, PID: '$util/inst' },
}