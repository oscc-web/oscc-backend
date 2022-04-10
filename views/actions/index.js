// Imports
import { BadRequestError, CustomError } from 'lib/errors.js'
import express from 'express'
// Middleware
// Libraries and utilities
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
// Local dependencies
import pathMatch from 'lib/middleware/pathMatch.js'
// Compose the server
const server = express()
	.use(pathMatch('/reset-mail/', wrap(async (req, res, next) => {
		const { pathMatch: { path }, params } = req, userID = path
		if (!params || typeof params !== 'object') throw new BadRequestError
	})))
	// Request error handler
	.use(CustomError.handler)
	// Remove express powered-by header
	.disable('x-powered-by')
// Launch server
Resolved.launch(server)
