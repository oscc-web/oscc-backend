// Environmental setup
import { ArgumentFormatError, CustomError, InvalidOperationError } from 'lib/errors.js'
import logger from 'lib/logger.js'
import express from 'express'
// Middleware
// Libraries and utilities
import Resolved from 'utils/resolved.js'
import wrap from 'utils/wrapAsync.js'
import User from 'lib/user.js'
import * as searchFilters from './operations.js'
import privileged from 'lib/middleware/privileged.js'
import { PRIV } from 'lib/privileges.js'

const server = express()
	.use(
		privileged(
			PRIV.SEARCH_USERS,
			express.json(),
			wrap(async (req, res) => {
				// Retract search arguments
				const {
						QUERY_MATCH_ALL = true,
						...searchArgs
					} = req.body || {},
					// Check if searchArgs are legal
					searchArgsList = Object.keys(searchArgs),
					unknownSearchArgs = searchArgsList.filter(arg => !(arg in searchFilters))
				// Check if all search arguments are supported
				if (unknownSearchArgs.length) throw new InvalidOperationError(
					`search user by [${searchArgsList.join(', ')}]`,
					`filter(s) [${unknownSearchArgs.join(', ')}] are not supported`
				)
				// Get raw cursor of list of all users
				/** @type {import('mongo').cursor} */
				const cursor = await User.db.user.find({}), searchResults = []
				await cursor.forEach(dsc => {
					const
						user = new User(dsc),
						query = searchArgsList.map(searchArg => {
							const
								searchFilter = searchFilters[searchArg],
								searchArgument = searchArgs[searchArg]
							return searchFilter(user, searchArgument)
						})
					searchResults.push(
						Promise
							.all(query)
							.then(scores => {
								logger.debug(`${user} scores ${JSON.stringify(scores)}`)
								if (QUERY_MATCH_ALL && scores.includes(0)) return undefined
								else return [
									scores.reduce((a, b) => a + b, 0),
									user.userID,
								]
							})
					)
				})
				// Wait for all searches to complete
				await Promise
					.all(searchResults)
					.then(list => {
						const result = list
							.filter(el => !!el)
							.sort(([a], [b]) => b - a)
							.map(([score, id]) => id)
						logger.debug(`Got result ${result} from ${list}`)
						res.send(JSON.stringify(result))
					})
			}, 'requestHandler[search-user]')
		)
	)
	// Request error handler
	.use(CustomError.handler)
	// Remove express powered-by header
	.disable('x-powered-by')
// Launch server
Resolved.launch(server)
