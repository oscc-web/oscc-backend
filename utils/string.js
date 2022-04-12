export const ml = (segments, ...args) => segments
	.map((str, i) => str + (args[i]?.toString() || ''))
	.join('')
	.trim()
	.split('\n')
	.map(str => str.replace(/^\s*\|\s*/, ''))
	.join('\n')

export const sl = (segments, ...args) => segments
	.map((str, i) => str + (args[i]?.toString() || ''))
	.join('')
	.trim()
	.split('\n')
	.map(str => str.replace(/^\s*\|\s*/, ''))
	.join(' ')
