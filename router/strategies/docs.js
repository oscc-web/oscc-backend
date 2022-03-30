import express from 'express'
import { config, resolveDistPath } from 'lib/env.js'
import { PRIV } from 'lib/privileges.js'
import vhost from 'lib/middleware/vhost.js'
import conditional from 'lib/middleware/conditional.js'
import privileged from 'lib/middleware/privileged.js'
import statusCode from 'lib/status.code.js'
import Session from 'lib/session.js'

const staticFileServer = express.static(resolveDistPath('ysyx.docs'))

export default express()
	.use(conditional(
		({ url }) => /^\/PRIVATE/gi.test(url),
		privileged(
			PRIV.DOCS_PRIVATE_ACCESS, staticFileServer
		).otherwise(
			(req, res) => res
				.redirect(
					`https://${config.domain}/${	
						req.session instanceof Session
							? statusCode.ClientError.Forbidden
							: statusCode.ClientError.Unauthorized
					}`)
				.end()
		)
	).otherwise(
		staticFileServer
	))
