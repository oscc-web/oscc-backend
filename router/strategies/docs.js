import express from 'express'
import { resolveDistPath } from '../../lib/env.js'
import { PRIV } from '../../lib/privileges.js'
import vhost from '../../lib/middleware/vhost.js'
import conditional from '../../lib/middleware/conditional.js'
import privileged from '../../lib/middleware/privileged.js'
import statusCode from '../../lib/status.code.js'

const staticFileServer = express.static(resolveDistPath('ysyx.docs'))

export default express()
	.use(conditional(
		({ url }) => url.startsWith('/private'),
		privileged(
			PRIV.DOCS_PRIVATE_ACCESS, staticFileServer
		).otherwise(
			(req, res) => res.status(statusCode.ClientError.Unauthorized).end()
		)
	).otherwise(
		staticFileServer
	))