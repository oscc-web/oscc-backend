import { readFileSync } from 'fs'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import logger from 'lib/logger.js'
import Resolved from 'utils/resolved.js'
import statusCode from 'lib/status.code.js'
import { basename, dirname, resolve } from 'path'
import { CustomError } from 'lib/errors.js'
const path = import.meta.url.replace(/^\w+:\/\//, ''),
	orgs = Object.freeze(
		JSON.parse(readFileSync(
			resolve(dirname(path), `${basename(path, '.js')}.json`)
		))
	)
logger.info('Starting service')

const server = express()
	.post('*', cors(), bodyParser.text({ type: req => req.method === 'POST' }),
		(req, res) => {
			res
			const searchStr = req.payload.trim()
			res.end(`hello, ${searchStr}`)
		})
	// Fall through request handler
	.use((req, res) => res.status(statusCode.ClientError.BadRequest).end())
	.use(CustomError.handler)
// Launch service through resolved
Resolved.launch(server)
