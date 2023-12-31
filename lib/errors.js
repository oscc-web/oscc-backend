import statusCode from './status.code.js'
import { IncomingMessage, ServerResponse } from 'http'
/**
 * @typedef {Object} ErrorDetails
 * Detailed information of this request
 * @property {import('lib/user.js').default} [user]
 * The user who made this request
 * @property {String} [url]
 * The url of current request
 */
// Abstract class for all custom errors
export class CustomError extends Error {
	get name() { return this.constructor.name }
	get level() { return 'warn' }
	get code() { return statusCode.ClientError.Conflict }
	/**
	 * @param {String} message
	 * @param {ErrorDetails} details
	 */
	constructor(message, { user = 'GuestUser', url, domain, method } = {}) {
		super(
			`${
				user
			} ${
				message
			} (${JSON.stringify({
				url, domain, method
			})})`
		)
	}
	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	async handle(req, res) {
		// Send status
		try { res.status(this.code) } catch (e) { console.log(e.stack) }
		// End request
		try { res.end(this.constructor.name) } catch (e) { console.log(e.stack) }
	}
	/**
	 * Thrown for logging
	 */
	toString() {
		return `${this.name}: ${this.message}`
	}

	static get handler() {
		return function customErrorHandler(err, req, res, next) {
			try {
				if (err instanceof CustomError) {
					import('lib/logger.js')
						.then(logger => logger.default[err.level](err.toString()))
					// Handle the response with error response handler
					err.handle(req, res)
				} else if (req instanceof IncomingMessage) {
					import('lib/logger.js').then(
						logger => logger.default.warn(
							`Got Uncaught error upon [${
								req?.method
							}] ${
								req?.headers?.host
							}${
								req?.url
							} from ${
								req?.origin
							}\n${
								err.stack
							}`
						)
					)
					if (res instanceof ServerResponse) res
						.status(statusCode.ServerError.InternalServerError)
						.end('Internal Server Error')
				} else {
					import('lib/logger.js').then(
						logger => logger.default.error(err.stack
						)
					)
				}
				// eslint-disable-next-line no-empty
			} catch (e) {}
		}
	}
}
/**
 * Thrown when request does not contain expected field,
 * or the data can not be correctly parsed
 */
export class BadRequestError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.BadRequest }
	/**
	 * @param {string} operation
	 * Name of the unprivileged operation
	 * @param {ErrorDetails} details
	 */
	constructor(requiredField, given = null, details) {
		super(
			`requested this API without required ${
				requiredField
			}, instead, user is giving ${
				JSON.stringify(given)
			}`,
			details
		)
	}
}
/**
 * Thrown when request does not contain expected field,
 * or the data can not be correctly parsed
 */
export class ArgumentFormatError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.BadRequest }
	/**
	 * @param {string} operation
	 * Name of the unprivileged operation
	 * @param {ErrorDetails} details
	 */
	constructor(argName, value, details) {
		super(
			`requested this API with malformed argument ${
				argName
			}=${
				value
			}`,
			details
		)
	}
}
/**
 * Thrown when request does not contain expected field,
 * or the data can not be correctly parsed
 */
export class ChallengeFailedError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.NotAcceptable }
	/**
	 * @param {string} operation
	 * Name of the unprivileged operation
	 * @param {ErrorDetails} details
	 */
	constructor(challenge, details) {
		super(
			`did not pass ${
				challenge
			}`,
			details
		)
	}
}
/**
 * Thrown when user is logged in but have no privilege
 * to make this request
 */
export class LoginRequestedError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.Unauthorized }
	/**
	 * @param {string} operation
	 * Name of the unprivileged operation
	 * @param {ErrorDetails} details
	 */
	constructor(operation = 'access this url', details) {
		super(
			`needs to be logged in before ${
				operation
			}`,
			details
		)
	}
}
/**
 * Thrown when user is logged in but have no privilege
 * to make this request
 */
export class PrivilegeError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.Forbidden }
	/**
	 * @param {string} operation
	 * Description of the operation that the user is trying to perform.
	 * e.g. 'update Group <student-level-1> to {...}'
	 * @param {ErrorDetails} details
	 */
	constructor(operation, details) {
		super(
			`has no sufficient privilege to ${
				operation
			}`,
			details
		)
	}
}
/**
 * Thrown when user is requesting to create an unique entry which already
 * exists in the system and
 */
export class ConflictEntryError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.Conflict }
	/**
	 * @param {*} existingEntry
	 * @param {*} requestedEntry
	 * @param {ErrorDetails} details
	 */
	constructor(existingEntry, requestedEntry, details) {
		super(
			`failed to create ${
				requestedEntry
			}: ${
				existingEntry
			} already exists`,
			details
		)
	}
}
/**
 * Thrown when user is requesting a non-existent entry
 */
export class EntryNotFoundError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.NotFound }
	/**
	 * @param {String} entryName
	 * The full name that fully describes this entry.
	 * e.g. 'User <john>', 'Group <student-level-1>' ...
	 * @param {ErrorDetails} details
	 */
	constructor(entryName, details) {
		super(
			`trying to find ${
				entryName
			} which does NOT exist`,
			details
		)
	}
}
/**
 * Thrown when user is making an invalid operation.
 * This usually means that such operation was not defined in our
 * switch-case block or got misspelled (sometimes in the wrong CASE).
 */
export class InvalidOperationError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.BadRequest }
	/**
	 * @param {String} operation
	 * Name of the operation, which is likely to be defined like:
	 * `body.action`, `body.operation`, `payload.action`, `payload.operation`
	 * @param {ErrorDetails} details
	 */
	constructor(operation, details) {
		super(
			`trying to make invalid operation '${
				operation
			}'`,
			details
		)
	}
}
/**
 * Thrown when user is making an invalid operation.
 * This usually means that such operation was not defined in our
 * switch-case block or got misspelled (sometimes in the wrong CASE).
 */
export class OperationFailedError extends CustomError {
	get level() { return 'warn' }
	get code() { return statusCode.ServerError.InternalServerError }
	/**
	 * @param {String} operation
	 * Name of the operation, which is likely to be defined like:
	 * `body.action`, `body.operation`, `payload.action`, `payload.operation`
	 * @param {ErrorDetails} details
	 */
	constructor(operation, details) {
		super(
			`failed to '${
				operation
			}'`,
			details
		)
	}
}
/**
 * Thrown when user is making an invalid operation.
 * This usually means that such operation was not defined in our
 * switch-case block or got misspelled (sometimes in the wrong CASE).
 */
export class IllegalSizeError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.PayloadTooLarge }
	/**
	 * @param {String} operation
	 * Name of the operation, which is likely to be defined like:
	 * `body.action`, `body.operation`, `payload.action`, `payload.operation`
	 * @param {ErrorDetails} details
	 */
	constructor(actualSize, expectedSize, { condition = 'less than', ...details } = {}) {
		super(
			`is trying to upload file (size: '${
				actualSize
			}'), which is expected to be ${
				condition
			} ${
				expectedSize
			}`,
			details
		)
	}
}
/**
 * Thrown when user is making an invalid operation.
 * This usually means that such operation was not defined in our
 * switch-case block or got misspelled (sometimes in the wrong CASE).
 */
export class TypeUnsupportedError extends CustomError {
	get level() { return 'errAcc' }
	get code() { return statusCode.ClientError.UnsupportedMediaType }
	/**
	 * @param {String} operation
	 * Name of the operation, which is likely to be defined like:
	 * `body.action`, `body.operation`, `payload.action`, `payload.operation`
	 * @param {ErrorDetails} details
	 */
	constructor(inputType, expectedType, details) {
		super(
			`is trying to upload file (type: '${
				inputType
			}'), which is expected to be ${
				expectedType
			}`,
			details
		)
	}
}
