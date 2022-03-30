import 'colors'
import lodash from 'lodash'
const { _ } = lodash
export default class Test {
	/**
	 * @type {String}
	 */
	name
	/**
	 * @type {String}
	 */
	trace = (new Error).stack.split('\n').filter(str => /^\s*at\s*/i.test(str))[2].replace(/^\s*at\s*(.*\()?/i, '').replace(/\).*$/i, '')
	/**
	 * @type {Number | String | Function<Boolean> | undefined}
	 */
	#expect
	expect(val) {
		this.#expect = val
		return this
	}
	/**
	 * @type {Boolean}
	 */
	endOnUncaughtError
	/**
	 * @type {Promise<boolean>}
	 */
	result
	/**
	 * @type {{res: (result: Boolean) => undefined, rej: Function}}
	 */
	promise
	/**
	 *
	 * @param {String} name
	 * @param {Number | String | Function<Boolean> | undefined} expect
	 * @param {Boolean} endOnUncaughtError
	 */
	constructor(name, expect = () => true, endOnUncaughtError = false) {
		[
			this.name,
			this.#expect,
			this.endOnUncaughtError
		] = [name, expect, endOnUncaughtError]
		this.result = new Promise((res, rej) => this.promise = { res, rej })
	}
	// Push test into queue
	/**
	 * register callback function to run
	 * @param {Function} f
	 * @returns {Test}
	 */
	run(f) {
		if (typeof f !== 'function') throw new SyntaxError('Test input has to be a function')
		Test.queue(this).then(async () => {
			try {
				const result = await f()
				let pass
				if (this.#expect?.prototype && result instanceof this.#expect) {
					pass = true
				} else if (typeof this.#expect === 'function') {
					pass = this.#expect(result)
				} else if (typeof this.#expect === 'object' && _.isEqual(this.#expect, result)) {
					pass = true
				} else {
					pass = result === this.#expect
				}
				if (pass) return this.#pass(`Returns as expected: ${JSON.stringify(result)}`)
				else return this.#fail(`Unexpected result: ${JSON.stringify(result)}`)
			} catch (e) {
				if (this.#expect.prototype && e instanceof this.#expect) {
					return this.#pass(`Throws error as expected: ${e.stack}`)
				} else {
					if (this.endOnUncaughtError) throw e
					return this.#fail(`Unexpected error: ${e.stack.underline}`)
				}
			}
		})
		return this
	}
	#pass(info) {
		if (Test.verbose) {
			console.log(`Test PASSED: ${this.name}`.green)
			console.log(info.dim)
		}
		this.promise.res(true)
	}
	#fail(info) {
		if (!Test.silent) {
			console.log(`Test FAILED: ${this.name} (${this.trace.underline})`.red)
			console.log(info.dim)
		}
		this.promise.res(false)
	}
	/**
	 * Output tuning settings
	 */
	static verbose = false
	static silent = false
	/**
	 * Asynchronous test queue
	 * @param {Test} test
	 */
	static queue(test) {
		return new Promise(res => {
			this.$queue.push(async () => {
				// Release queue lock
				res()
				// Wait for result to propagate
				test.result = await test.result
				// Return test object
				return test
			})
		})
	}
	static $queue = []
	// Execute test queue
	static async run() {
		const summary = []
		for (const cb of this.$queue) {
			summary.push(await cb())
		}
		this.$queue = []
		return summary
	}
	// Summary of the entire queue
	static summary(tests) {
		return {
			total: tests.length,
			passed: tests.filter(({ result }) => result).length,
			failed: tests.filter(({ result }) => !result).length
		}
	}
	// Formatted summary
	static formatSummary(title, summary) {
		const maxLength = Object.keys(summary).map(el => el.length).reduce((a, b) => Math.max(a, b)),
			str = [
				` Test summary for ${title}: `,
				...Object
					.entries(summary)
					.map(([name, value]) => `  - ${name.padEnd(maxLength)}: ${value.toString()} `)
			],
			lineWidth = Math.max(...str.map(el => el.length)) + 1,
			[bs, be] = ['▄', '▀'].map(el => ` ${''.padEnd(lineWidth, el)}`),
			color = summary.failed ? 'yellow' : 'green',
			bgColor = summary.failed ? 'bgYellow' : 'bgGreen'
		return [
			bs[color],
			...str.map(str => ` ${str.padEnd(lineWidth).black[bgColor]}`),
			be[color],
		].join('\n')
	}
}
