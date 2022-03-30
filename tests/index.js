import Test from './Test.js'
let loggerOutputLevel
const
	list = ['mongo', 'user', 'session', 'groups'],
	params = {
		h() { this.help() },
		help() {
			let maxLength = 0,
				out = {
					'-h, --help': 'Print this message',
					'-v, --verbose': 'Output all test info, including successful ones',
					'-V': 'Toggle both tester and logger\'s verbose mode',
					'-s, --silent': 'Output nothing (exit code only)',
				}
			console.log(
				Object
					.entries(out)
					.map(([name, value]) => {
						maxLength = Math.max(maxLength, name.length)
						return [name, value]
					})
					.map(([name, value]) => {
						maxLength = Math.max(maxLength, name.length)
						return [name.padEnd(maxLength, ' '), value].join(': ')
					})
					.join('\n')
			)
			process.exit(0)
		},
		v() { this.verbose() },
		verbose() {
			Test.verbose = true
		},
		V() {
			loggerOutputLevel = 'verbose'
			this.verbose()
		},
		s() { this.silent() },
		silent() {
			Test.silent = true
		}
	}
let args = process.argv
		.slice(2)
		// Parse and filter flags
		.filter(arg => {
			if (arg = /^-(?<arg>[A-Za-z]+)$/.exec(arg)?.groups?.arg) {
				arg.split('').forEach(c => { if (c in params) params[c]() })
				return false
			}
			if (arg = /^-(?<arg>[A-Za-z]+)$/.exec(arg)?.groups?.arg) {
				if (arg in params) params[arg]()
				return false
			}
			return true
		}),
	failedCount = 0
if (args.length === 0) args = list
// Add path elements to arg string
args = args
	// Add prefix
	.map(el => [el, el])
	// Add prefix
	.map(([el, _]) => [/^\.?\//.test(el) ? el : `./${el}`, _])
	// Add suffix
	.map(([el, _]) => [/\.[cm]?js$/.test(el) ? el : `${el}.js`, _])
// Test scripts specified by args
for (const [file, name] of args) {
	try {
		await import(file)
		const results = await Test.run(),
			summary = Test.summary(results)
		if (!Test.silent) console.log(Test.formatSummary(name, summary))
		failedCount += summary.failed || 0
	} catch (e) {
		if (!Test.silent) {
			console.log('---- Uncaught error '.padEnd(process.stdout.columns, '-'))
			console.log(e.stack)
			console.log(''.padEnd(process.stdout.columns, '-'))
		}
		failedCount++
	}
}
process.exit(failedCount)
