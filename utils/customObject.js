export default class CustomObject extends Object {
	toString() {
		return `${this.constructor.name} <${this[Symbol.toStringTag]}>`
	}
}