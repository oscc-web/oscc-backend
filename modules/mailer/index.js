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
/**
 * @typedef {nodemailer.SMTPConnection.Options} mailerConfig
 */
const SMTP = config.mailer
// Create nodemailer transport
const transport = nodemailer.createTransport(SMTP)
logger.info(`Starting with account <${SMTP.auth.user}>`)
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
					// Receive the body of email
					const payload = JSON.parse(body.join(''))
					if (!payload || typeof payload !== 'object') {
						// Payload is not a valid JSON object
						logger.warn(`Request payload is not an JSON object: ${JSON.stringify(payload)}`)
						return res.status(400).send()
					}
					// Check if requested fields exist in payload
					const { template, args, to } = payload
					if (false
						|| !template || typeof template !== 'string'
						|| !args || typeof args !== 'object'
						|| !to || typeof to !== 'string'
					) {
						logger.warn(`Request has insufficient arguments: ${JSON.stringify({ to, template, args })}`)
						return res.status(400).send()
					}
					let subject, html
					try {
						({ subject, html } = render(template, args))
					} catch (error) {
						logger.warn(error.stack)
						res.status(statusCode.ClientError.BadRequest).end()
						return
					}
					// Fs.writeFileSync(`${PROJECT_ROOT}/var/log/mailer/${template}.out.html`, html)
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
	// Check if templates exist
	if (fs.existsSync(indexHtmlPath) && fs.existsSync(templateHtmlPath)) {
		let subject,
			templateHtml = fs
				.readFileSync(templateHtmlPath)
				.toString()
				// Get title in html template, and delete it from html template.
				.replace(
					/^-{3,}\n(?<content>(.*\n)*?)-{3,}/m,
					(...args) => {
						const groups = args.pop()
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
			// Replace {{key}} with HTML/CSS template
			html = fs
				.readFileSync(indexHtmlPath)
				.toString()
				.replace(
					/\{\{\s*(?<entry>\w+)\s*\}\}/g,
					(...arg) => {
						const { entry } = arg.pop()
						return {
							templateCss,
							indexCss,
							html: soda(
								templateHtml, { DOMAIN, ...args })
						}[entry]
					}
				)
		return { subject, html }
	}
	throw Error(`Template ${templateName} not exist`)
}
