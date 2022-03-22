import EventEmitter from 'events'

export default class CustomObject extends EventEmitter {
	toString() {
		return `${this.constructor.name} <${this[Symbol.toStringTag]}>`
	}
}