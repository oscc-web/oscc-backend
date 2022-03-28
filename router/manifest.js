import { Args, config } from 'lib/env.js'
// eslint-disable-next-line no-undef
const res = getResolver(import.meta)
// Process
export default {
	[res()]: { cluster: 10, port: Args.port || config.port || 8000 },
}