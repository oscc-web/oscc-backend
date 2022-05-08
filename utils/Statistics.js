import lo from 'lodash'
import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { dirname, resolve } from 'path'
import { PROJECT_ROOT } from 'lib/env.js'
import dbInit from './mongo.js'

const flagHandler = {
	// Specify the collection name and entry name to be searched
	// e.g. -e log.message
	// e.g. -e User.userID
	e(flags, arg) {
		if (!arg || typeof arg !== 'string') throw new SyntaxError
		const [collection, ...entry] = arg.split('.')
		if (entry.length == 0) throw new TypeError('entry name is not specified')
		Object.assign(flags, {
			collection, entry: entry.join('.')
		})
	},
	// Post-match replacement function
	r: (flags, str) => eval(str),
	// Sorting indexer
	s: (flags, exp) => {
		if (!exp) throw new SyntaxError
		flags.sorter = eval(`([$a, a], [$b, b]) => (${exp})`)
	},
	// Regex case insensitive
	i: (flags, _) => {
		if (!flags.rxFlags.includes('i')) flags.rxFlags += 'i'
		return _
	},
	g: (flags, _) => {
		if (!flags.rxFlags.includes('g')) flags.rxFlags += 'g'
		return _
	},
	// Output file path
	o: (flags, path) => {
		flags.out = resolve(PROJECT_ROOT, 'var', 'statistics', path)
	}
}

const $ = (a, b) => a != b
	? a > b && -1 || 1
	: 0

export default async function stat(args) {
	const
		flags = {
			map: doc => lo
				.property(flags.entry.split('.'))(doc)
				.match(regex)[0],
			// Name of the database collection to stat
			collection: 'log',
			entry: 'message',
			// Sort indexer
			sorter: ([$a, a], [$b, b]) => $(a, b),
			// Regexp flags
			rxFlags: '',
			// Path of output file
			out: undefined
		},
		regex = new RegExp(
			args
				.replace(
					/(?<=^|\s+)-([a-zA-Z])(\s*|=)([^-].*?)?(?=\s+|$)/gi,
					(_, flag, space, content) => {
						if (flag in flagHandler) {
							return flagHandler[flag](flags, content) || ''
						} else {
							flags[flag] = true
							return content
						}
					}
				)
				.trim() || '.*',
			flags.rxFlags
		),
		db = dbInit(`${flags.collection}/R`)[flags.collection],
		cursor = await db.find({ [flags.entry]: { $regex: regex } }),
		stat = {}
	// Make indexed stat
	await cursor
		.map(flags.map)
		.forEach(key => stat[key] = (stat[key] || 0) + 1)
	// Generate statistics report
	const
		result = Object
			.entries(stat)
			.sort(flags.sorter)
			.map(([key, val]) => [val, key]),
		padLength = (result?.[0]?.[0] || '').toString().length
	// Output the result
	if (flags.out) {
		// Output to file
		console.log([
			'Writing statistics for'.yellow,
			flags.collection.cyan,
			'->'.yellow,
			flags.entry.cyan,
			'to'.yellow,
			flags.out.cyan.underline
		].join(' '))
		// Make sure the dir exists
		ensureDirSync(dirname(flags.out))
		// Do the write
		writeFileSync(
			flags.out,
			result
				.map(([i, key]) => `${i}\t${JSON.stringify(key)}`)
				.join('\n')
		)
	} else {
		// Output to console
		console.log([
			'Printing statistics for'.yellow,
			flags.collection.blue.underline,
			'->'.yellow,
			flags.entry.blue.underline
		].join(' '))
		console.log()
		result.forEach(([count, key]) => console.log([
			count.toString().padStart(padLength + 1, ' ').yellow,
			key.green
		].join(' │ '.dim)))
		console.log()
	}
}
