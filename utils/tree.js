/**
 * @type {Object.<string, (string) => string>}
 */
const scheme = {
	node: str => str,
	value: str => str,
	joint: str => str,
}

export default class Tree {
	#data = {}
	get data() { return this.#data }
	get isEdgeNode() {
		return typeof this.#data === 'string'
	}
	/**
	 * @type {[name: string, Tree][]}
	 */
	get entries() {
		return this.isEdgeNode
			? []
			: Object.entries(this.#data)
	}
	/**
	 * @type {Tree[]}
	 */
	get children() {
		return this.isEdgeNode
			? []
			: Object.values(this.#data)
	}
	/**
	 * @type {Tree[]}
	 */
	get keys() {
		return this.isEdgeNode
			? [this.#data]
			: Object.keys(this.#data)
	}
	/**
	 * Width of serialized chunk
	 * @type {Number} width
	 */
	get width() {
		return this.keys.reduce((m, s) => Math.max(m, noColor(s).length), 0)
	}
	/**
	 * Convert tree into printable chunks
	 * @param {Number} [width]
	 * @param {...Number} [widths]
	 * @returns {[String[], Number[]]}
	 */
	serialize(width = this.width, ...widths) {
		if (this.isEdgeNode) return [[pad(scheme.value(this.#data), width)], [0]]
		else {
			const lines = [], joints = []
			for (const [nodeName, subTree] of this.entries) {
				const [l = [], j = []] = subTree.serialize(...widths)
				if (l.length && j.length) {
					const titleLine = Math.floor((Math.max(...j) + Math.min(...j)) / 2),
						jMap = Object.fromEntries(
							j.length > 1
								? j.map((n, i) => {
									const t = n == titleLine
									if (i == 0) return [n, t ? '─┬─╴' : ' ┌─╴']
									else if (i + 1 >= j.length) return [n, t ? '─┴─╴' : ' └─╴']
									else return [n, t ? '─┼─╴' : ' ├─╴']
								})
								: [[j[0], '───╴']]
						)
					lines.push(...l.map((line, i) => {
						const joint = jMap[i] || (
							i < Math.min(...j) || i > Math.max(...j)
								? '    '
								: undefined
						)
						const isTitleLine = titleLine == i
						// console.log({ jMap, i, joint }, i in jMap, jMap[i])
						if (isTitleLine) {
							joints.push(lines.length + i)
						}
						const [t, s, b] = isTitleLine
							? [nodeName, '╶', joint === undefined ? ' ┤  ' : joint]
							: ['', ' ', joint === undefined ? ' │  ' : joint]
						return [
							pad(scheme.node(t), width),
							line && scheme.joint(s + b),
							line
						].join('')
					}))
				} else {
					lines.push(scheme.value(nodeName))
					joints.push(joints.length)
				}
			}
			return [lines, joints]
		}
	}
	/**
	 * Get the max width of each depth level
	 * @returns {Number[]}
	 */
	normalize() {
		const widths = [this.width]
		let { children } = this
		while (children.length) {
			widths.push(Math.max(...children.map(({ width }) => width)))
			children = children.map(t => t.children).flat()
		}
		return widths
	}
	/**
	 * @param {Object | Serializable} data
	 */
	constructor(data) {
		if (data && { object: 1, function: 1 }[typeof data]) {
			for (const name in data) {
				this.#data[name] = new Tree(data[name])
			}
		} else {
			this.#data = data?.toString() || JSON.stringify(data) || typeof data
		}
	}
	/**
	 * toString tricks
	 */
	toString() {
		return this[Symbol.toStringTag]
	}
	get [Symbol.toStringTag]() {
		const [lines] = this.serialize(...this.normalize())
		return ['', ...lines, ''].join('\n')
	}
}

const noColor = str => str.replace(/\033\[[0-9;]+m/g, '')

function pad(str, width) {
	const ws = width - noColor(str).length
	return [Math.floor(ws / 2), Math.ceil(ws / 2)]
		.map(x => ''.padEnd(x, ' '))
		.join(str)
}
