export default class Enum {
	#_ = 0
	get _() { return this.#_++ }
	set _(val) {
		if (typeof val !== 'number') throw new TypeError
		this.#_ = val
	}
	constructor(startNum = 0) {
		this.#_ = startNum
	}
}
