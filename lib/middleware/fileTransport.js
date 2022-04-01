import fs from 'fs-extra'
import { resolve } from 'path'
import statusCode from '../status.code.js'
import { PROJECT_ROOT } from '../env.js'
import wrap from 'utils/wrapAsync.js'
import logger from '../logger.js'
import { v4 as getUid } from 'uuid'
import { IllegalSizeError, TypeUnsupportedError } from '../errors.js'
/**
 * @param {string} dir
 * FileTransport saving directory
 * @param {{
 * 	contentType: String | RegExp,
 * 	maxSize: Number,
 * 	checkID: (fileID: String) => Boolean
 * }}
 * @returns {import('express').Handler}
 */
export default function fileTransport(dir = resolve(PROJECT_ROOT, 'var/tmp'), {
	contentType,
	maxSize = 512 * 1024,
	checkID = () => true
}) {
	fs.ensureDirSync(dir)
	const checkContentType = (() => {
		if (!contentType) return () => true
		else if (typeof contentType === 'string') {
			contentType = contentType.toLowerCase()
			return t => t.toLowerCase() === contentType
		} else if (contentType instanceof RegExp) {
			return t => new RegExp(contentType).test(t)
		} else throw new TypeError
	})()
	return wrap(async function(req, res, next) {
		const { fileID, filePath } = await (async () => {
				let fileID, filePath
				// eslint-disable-next-line no-constant-condition
				while (true) {
					fileID = getUid()
					filePath = resolve(dir, fileID)
					// Check for filename collision
					if (fs.existsSync(filePath)) continue
					// Additional collision check
					if (!await checkID(fileID)) continue
					// 'fileID' is unique
					break
				}
				return { fileID, filePath }
			})(),
			reqContentType = req.headers?.['content-type'],
			/**
			 * @type {Number | undefined}
			 * Number: length of content, when request has header 'content-length',
			 * otherwise undefined
			 */
			claimedSize = parseInt(req.headers?.['content-length']) || undefined,
			writeStream = fs.createWriteStream(filePath),
			user = await req?.session?.user, { url } = req
		// Check content type
		if (!checkContentType(reqContentType)) return next(
			new TypeUnsupportedError(reqContentType, contentType, { user, url })
		)
		// Check if claimed size exceeds max size
		if (claimedSize > maxSize) return next(
			new IllegalSizeError(claimedSize, maxSize, { user, url })
		)
		// Inject fileID and filePath into request
		Object.assign(req, { fileID, filePath })
		// Initialize file size counter
		let totalSize = 0
		req.on('data', chunk => {
			// Data pipe may have been closed because of size error
			if (!writeStream.writable) return
			// Check size limit
			if (checkLimit(totalSize += chunk.length, maxSize, claimedSize, false)){
				writeStream.write(chunk)
			} else {
				writeStream.close()
				// Remove buffered local file
				fs.removeSync(filePath)
				// Stop transporting the data
				req.removeAllListeners('end')
				// Call error handler
				next(new IllegalSizeError(totalSize, maxSize, { user, url }))
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
				next(new IllegalSizeError(totalSize, claimedSize, { user, url, condition: 'equal to' }))
			}
			// Res.status(statusCode.Success.OK).end(fileID)
		}))
	}, `fileTransport[${dir}]`)
}
/**
 * Check if current size fits into the constraints of max size and claimed size
 */
function checkLimit(currentSize, maxSize, claimedSize, end = false) {
	return currentSize <= maxSize && (
		// Only strictly check size of content if specified in request headers
		claimedSize && end
			? currentSize && currentSize == claimedSize
			: currentSize && currentSize <= claimedSize
	)
}
