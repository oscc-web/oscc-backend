// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res('mailer')]: { cluster: 2 },
	[res('upload')]: { cluster: 5 },
	// [res('deploy')]: { cluster: 2 },
}