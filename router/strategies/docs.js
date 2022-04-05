import express from 'express'
import { config } from 'lib/env.js'
import { PRIV } from 'lib/privileges.js'
import privileged from 'lib/middleware/privileged.js'
import statusCode from 'lib/status.code.js'
import Session from 'lib/session.js'
import Deployer from 'lib/deployer.js'
import pathMatch from 'lib/middleware/pathMatch.js'
import withSession from 'lib/middleware/withSession.js'

export default express().use(
	pathMatch('/private',
		withSession(),
		privileged(PRIV.DOCS_PRIVATE_ACCESS).otherwise(
			(req, res) => res.redirect(
				`https://${config.domain}/${
					req.session instanceof Session
						? statusCode.ClientError.Forbidden
						: statusCode.ClientError.Unauthorized
				}`)
		)
	),
	new Deployer('docs', true).server
)
