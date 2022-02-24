import http from 'http'
import nodemailer from 'nodemailer'
import fs from 'fs'
import soda from 'sodajs/dist/soda.node.js'
// Environmental setup
import { init, logger, config, PROJECT_ROOT } from '../../lib/env.js'
init(import.meta)

const SMTP = config.mailer
// create nodemailer transport
const transport = nodemailer.createTransport(SMTP)
logger.info(`Starting Mailer as <${SMTP.auth.user}>`)
http.createServer((req, res) => {
	const body = []
	if (req.method !== 'POST') {
		logger.warn(`Rejected ${req.method} request from ${req.origin}`)
		res.writeHead(404).end()
	} else {
		req
			.on('data', chunk => body.push(chunk))
			.on('end', () => {
				logger.access(`${req.method} ${req.headers.host}${req.url} from ${req.origin}`)
				// receive the body of email
				const payload = JSON.parse(body.join(''))
				if (!payload || typeof payload !== 'object') {
					// Payload is not a valid JSON object
					return logger.warn('Request payload is not an JSON object: ' + JSON.stringify(payload)) && res.writeHead(400).end()
				}
				// Check if requested fields exist in payload
				let { template, args, to } = payload
				if (false
					|| !template || (typeof template !== 'string')
					|| !args || (typeof args !== 'object')
					|| !to || (typeof to !== 'string')
				) return logger.warn('Request has insufficient arguments: ' + JSON.stringify({ to, template, args })) && res.writeHead(400).end()
				let subject, html
				try {
					let renderResult = render(template, args)
					subject = renderResult.subject
					html = renderResult.html
				} catch (error) {
					logger.warn(error.stack)
					res.writeHead(500).end()
					return
				}
				fs.writeFileSync(`${PROJECT_ROOT}/var/log/mailer/${template}.out.html`, html)
				transport.sendMail({
					from: SMTP.auth.user,
					sender: SMTP.sender || 'Mail bot',
					to,
					subject,
					html
				})
					.then(() => res.writeHead(200).end())
					.then(() => logger.info(`Mail "${subject}" sent to ${to} with args ${JSON.stringify(args)}`))
					.catch(e => logger.warn('Failed to send mail: ' + e.stack))
			})
	}
}).listen(config.port.mailer, () => {
	logger.info(`Mailer up and running at port ${config.port.mailer}`)
})

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
						return { templateCss, indexCss, html: soda(templateHtml, args) }[entry]
					}
				)
		return { subject, html }
	}
	throw Error(`Template ${templateName} not exist`)
}