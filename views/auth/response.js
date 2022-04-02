import statusCode from 'lib/status.code.js'
export function success(res) {
	return res.status(statusCode.Success.OK).end()
}
/**
 * Indicate that user has not been logged in
 * @param {import('express').Response} res
 * @returns
 */
export function sessionNotFound(res) {
	return res.status(statusCode.ClientError.Unauthorized).end()
}
