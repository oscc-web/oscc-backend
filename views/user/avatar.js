import { AppDataWithFs } from 'lib/appDataWithFs.js'
import statusCode from 'lib/status.code.js'
import logger from 'lib/logger.js'
let appDataWithFs = new AppDataWithFs('user-profile')
/**
 * @param {(import('express').Request)} req
 * @param {(import('express').Response)} res
 * @param {(import('express').NextFunction)} next
 * @returns {(import('express').NextFunction)}
 */
export async function getUserAvatar(req, res, next) {
	const { session } = req, user = await session.user,
		ownerID = req?.userID
	appDataWithFs
		.loadFile({ userID: ownerID, url: '/avatar' })
		.then(async fileDescriptor => {
			if (!fileDescriptor) return res.sendStatus(statusCode.ClientError.NotFound)
			// Pipe file to res
			fileDescriptor.pipe(res)
			logger.access(`send file ${fileDescriptor.fileID} to <${req.origin}>`)
		})
		.catch(e => {
			logger.errAcc(`Can not get ${ownerID}'s avatar: ${e.stack}`)
			res.sendStatus(statusCode.ServerError.InternalServerError)
		})
	return next()
}
