import { readFileSync } from 'fs-extra'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import logger from '../../lib/logger.js'
import errorHandler from '../../utils/errorHandler.js'
import Resolved from '../../utils/resolved.js'
import statusCode from '../../lib/status.code.js'
const institutions = Object.freeze(
	JSON.parse(readFileSync('./institutions.json'))
)
logger.info('Starting service')

const server = express()
	.use()
	.post('*', cors(), bodyParser.text({ type: req => req.method === 'POST' }),
		(req, res) => {
			res
			const searchStr = req.payload.trim()
			res.end('hello, ' + searchStr)
		})
	// Fall through request handler
	.use((req, res) => res.status(statusCode.ClientError.BadRequest).end())
	.use(errorHandler)
// Launch service through resolved
Resolved.launch(server)
