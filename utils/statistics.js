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
	m: (flags, str) => {
		if (str.startsWith('@')) {
			const preset = {
				ip: /(\d+\.){3}\d+/,
				id: /(?<=User\s*<).*?(?=>)/i,
				url: /([a-z0-9-]+\.)*([a-z]{2,3})(\/[a-z0-9-.]+)+/i
			}[str.slice(1)]
			if (preset instanceof RegExp) flags.map = str => str.match(preset)?.[0]
			else throw new Error(`Preset ${str} not found`)
		} else {
			flags.map = eval(str)
		}
	},
	// Post-match replacement function
	M: (flags, str) => {
		flags.mapUseFullDoc = true
		flagHandler.m(flags, str)
	},
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
			map: s => typeof s === 'string' ? s.match(regex)?.[0] : undefined,
			mapUseFullDoc: false,
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
	// Apply flags config
	if (!flags.mapUseFullDoc) {
		const
			docEntry = lo.property(flags.entry.split('.')),
			{ map } = flags
		flags.map = doc => map(docEntry(doc))
	}
	// Make indexed stat
	await cursor
		.map(doc => {
			try {
				return flags.map(doc) || ''
			} catch (e) {
				console.error(e)
				process.stdout.write(`Ignoring ${doc}\n`.yellow)
			}
		})
		.forEach(key => {
			if (key) stat[key] = (stat[key] || 0) + 1
		})
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
		process.stdout.write([
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
		process.stdout.write([
			'Statistics for'.yellow,
			flags.collection.blue.underline,
			'->'.yellow,
			flags.entry.blue.underline
		].join(' '))
		process.stdout.write('\n\n')
		process.stdout.write(
			result
				.map(([count, key]) => [
					count.toString().padStart(padLength + 1, ' ').yellow,
					key.green
				].join(' │ '.dim))
				.join('\n')
		)
		process.stdout.write('\n\n')
	}
}
