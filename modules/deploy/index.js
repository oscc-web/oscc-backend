import express from 'express'
import nodemailer from 'nodemailer'
import fs from 'fs'
import soda from 'sodajs/dist/soda.node.js'
// Environmental setup
import { config, PROJECT_ROOT, DOMAIN } from 'lib/env.js'
import logger from 'lib/logger.js'
import statusCode from 'lib/status.code.js'
import errorHandler from 'utils/errorHandler.js'
import Resolved from 'utils/resolved.js'
logger.info('Starting server')
const server = express()
	.use((req, res) => {
		const body = []
		if (req.method !== 'POST') {
			logger.warn(`Rejected ${req.method} request from ${req.origin}`)
			res.status(404).send()
		} else {
			req
				.on('data', chunk => body.push(chunk))
				.on('end', () => {
					logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
					// receive the body of email
					const payload = JSON.parse(body.join(''))
					if (!payload || typeof payload !== 'object') {
					// Payload is not a valid JSON object
						return logger.warn('Request payload is not an JSON object: ' + JSON.stringify(payload)) && res.status(400).send()
					}
					// Check if requested fields exist in payload
					let { template, args, to } = payload
					if (false
					|| !template || (typeof template !== 'string')
					|| !args || (typeof args !== 'object')
					|| !to || (typeof to !== 'string')
					) return logger.warn('Request has insufficient arguments: ' + JSON.stringify({ to, template, args })) && res.status(400).send()
					let subject, html
					try {
						let renderResult = render(template, args)
						subject = renderResult.subject
						html = renderResult.html
					} catch (error) {
						logger.warn(error.stack)
						res.status(statusCode.ClientError.BadRequest).end()
						return
					}
					// fs.writeFileSync(`${PROJECT_ROOT}/var/log/mailer/${template}.out.html`, html)
					transport.sendMail({
						from: SMTP.auth.user,
						sender: SMTP.sender || 'Mail bot',
						to,
						subject,
						html
					})
						.then(() => {
							res.status(statusCode.Success.OK).send()
							logger.info(`Mail "${subject}" sent to ${to} with args ${JSON.stringify(args)}`)
						})
						.catch(e => errorHandler(e, req, res))
				})
		}
	})
// Start the server using Resolved
Resolved.launch(server)

function render(templateName, args) {
	const
		path = `${PROJECT_ROOT}/modules/mailer/templates`,
		templateHtmlPath = `${path}/${templateName}.html`,
		indexHtmlPath = `${path}/index.html`,
		indexCssPath = `${path}/index.css`,
		templateCssPath = `${path}/${templateName}.css`
	// check if templates exist 
	if (fs.existsSync(indexHtmlPath) && fs.existsSync(templateHtmlPath)) {
		let subject,
			templateHtml = fs
				.readFileSync(templateHtmlPath)
				.toString()
				// get title in html template, and delete it from html template.
				.replace(
					/^-{3,}\n(?<content>(.*\n)*?)-{3,}/m,
					(...args) => {
						let groups = args.pop()
						subject = groups?.content.trim() || '来自一生一芯的邮件'
						return ''
					}
				),
			templateCss = fs.existsSync(templateCssPath)
				? fs.readFileSync(templateCssPath).toString()
				: '',
			indexCss = fs.existsSync(indexCssPath)
				? fs.readFileSync(indexCssPath).toString()
				: '',
			// replace {{key}} with HTML/CSS template
			html = fs
				.readFileSync(indexHtmlPath)
				.toString()
				.replace(
					/\{\{\s*(?<entry>\w+)\s*\}\}/g,
					(...arg) => {
						let { entry } = arg.pop()
						return { templateCss, indexCss, html: soda(
							templateHtml, { DOMAIN, ...args }) }[entry]
					}
				)
		return { subject, html }
	}
	throw Error(`Template ${templateName} not exist`)
}