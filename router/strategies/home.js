import express from 'express'
import conditional from 'lib/middleware/conditional.js'
import pathMatch from 'lib/middleware/pathMatch.js'
import proxy from 'lib/middleware/proxy.js'
import Resolved from 'utils/resolved.js'
import { CustomError } from 'lib/errors.js'
/**
 * Server instance
 */
const server = express()
	// Search institution
	.use(
		pathMatch
			.POST('/search-institution', proxy(new Resolved('$institution').resolver))
			.stripped
	)
	// Search user
	.use(
		pathMatch
			.POST('/search-user', proxy(new Resolved('$searchUser').resolver))
			.stripped
	)
	// Groups View
	.use(
		pathMatch
			.POST('/groups', proxy(new Resolved('$groups').resolver))
			.stripped
	)
	// User View
	.use(conditional(
		({ method, url }) => {
			const [prefix, userID, action = '', ...segments] = url.split('/').splice(1)
			if (prefix !== 'user' || !userID) return
			if (method !== 'POST' && !action.startsWith('avatar')) return
			return { url: ['', userID, action, ...segments].join('/') }
		},
		proxy(new Resolved('$user').resolver)
	))
	// Auth view
	.use(pathMatch.POST(/^\/(login|logout|register|auth)/ig,
		proxy(new Resolved('$auth').resolver)
	))
	// Standard error handler
	.use(CustomError.handler)
// Expose handle function as default export
export default (req, res, next) => server.handle(req, res, next)
