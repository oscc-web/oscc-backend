import fs from 'fs-extra'
import { resolve } from 'path'
import statusCode from '../status.code.js'
import { PROJECT_ROOT } from '../env.js'
import wrap from '../../utils/wrapAsync.js'
import logger from '../logger.js'
import { v4 as getUid } from 'uuid'
export class FileTransportError extends Error {
	constructor(fileID, { totalSize, maxSize, claimedSize }) {
		super(`size<${totalSize}> is unacceptable: ${JSON.stringify({ 
			maxSize, claimedSize
		})}`)
		this.fileID = fileID
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return `fileID ${this.fileID}` }
}
/**
 * 
 * @param {*} param0 
 * @returns {import('express').Handler}
 */
export default function fileTransport(dir = resolve(PROJECT_ROOT, 'var/tmp'), {
	maxSize = 512*1024,
	checkID = () => true
}) {
	fs.ensureDirSync(dir)
	return async function (req, res, next) {
		const { fileID, filePath } = await (async () => {
				let fileID, filePath
				// eslint-disable-next-line no-constant-condition
				while (true) {
					fileID = getUid()
					filePath = resolve(dir, fileID)
					// Check for filename collision
					if (fs.existsSync(filePath)) continue
					// Additional collision check
					if (!(await checkID(fileID))) continue
					// fileID is unique
					break
				}
				return { fileID, filePath }
			})(),
			/**
			 * @type {Number | undefined}
			 * Number: length of content, when request has header 'content-length',
			 * otherwise undefined
			 */
			claimedSize = parseInt(req.headers?.['content-length']) || undefined,
			writeStream = fs.createWriteStream(filePath)
		// Inject fileID and filePath into request
		Object.assign(req, { fileID, filePath })
		// Initialize file size counter
		let totalSize = 0
		req.on('data', chunk => {
			if (checkLimit(totalSize += chunk.length, maxSize, claimedSize, false)){
				writeStream.write(chunk)
			} else {
				writeStream.close()
				fs.removeSync(filePath)
				next(new FileTransportError(fileID, { totalSize, maxSize, claimedSize }))
			}
		})
		req.on('end', wrap(async () => {
			writeStream.close()
			if (checkLimit(totalSize, maxSize, claimedSize, true)){
				req.fileSize = totalSize
				logger.access(`File ${fileID} received from ${req.origin}`)
				next()
			} else {
				fs.removeSync(filePath)
				next(new FileTransportError(fileID, { totalSize, maxSize, claimedSize }))
			}
			// res.status(statusCode.Success.OK).end(fileID)
		}))
	}
}
/**
 * check if current size fits into the constraints of max size and claimed size
 */
function checkLimit(currentSize, maxSize, claimedSize, end = false) {
	return currentSize <= maxSize && (
		// Only strictly check size of content if spefied in request headers
		claimedSize !== undefined && end
			? currentSize == claimedSize
			: currentSize <= claimedSize
	)
}