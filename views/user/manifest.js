// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res('index')]: { cluster: 2, PID: '$user/index' },
}
