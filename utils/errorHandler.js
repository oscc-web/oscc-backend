import logger from 'lib/logger.js'
import statusCode from 'lib/status.code.js'

export default function(err, req, res, next) {
	logger.warn(`Got Uncaught error upon [${req?.method}] ${req?.headers?.host}${req?.url} from ${req?.origin}\n${err.stack}`)
	try {
		res.status(statusCode.ServerError.InternalServerError).end('Internal Server Error')
	// eslint-disable-next-line no-empty
	} catch (e) {}
}
