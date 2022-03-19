export default class CustomObject {
	toString() {
		return `${this.constructor.name} <${this[Symbol.toStringTag]}>`
	}
}