import express from 'express'
import { resolve } from 'path'
import { exec } from 'child_process'
import { ensureDir } from 'fs-extra'
import { PROJECT_ROOT } from 'lib/env.js'
import { MessageHub } from 'utils/ipc.js'
import wrap from 'utils/wrapAsync.js'
import { AppDataWithFs } from './appDataWithFs.js'
import { CustomError, OperationFailedError } from './errors.js'
import { FileDescriptor } from './fileDescriptor.js'
import logger from './logger.js'
import { appendFile, existsSync, readFileSync } from 'fs'
import { sl } from 'utils/string.js'
export default class Deployer extends MessageHub {
	/** @type {String} ID of this deployer */
	#id
	get id() { return this.#id }
	/** @type {Function} Promise resolver */
	#resolve
	/**
	 * The static file server
	 * @type {import('express').Express}
	 */
	#server = new Promise(r => this.#resolve = r)
	/** @type {import('express').handler} */
	get server() {
		const { id } = this
		return wrap(async (req, res, next) => {
			if (this.#server instanceof Promise) {
				logger.warn(`Accessing Deployer <${id}> before resolution`)
				await this.#server
			}
			this.#server.handle(req, res, next)
		}, `deployer[${id}]`)
	}
	/** AppData identifier for deployment data */
	get identifier() {
		return { deployID: this.id }
	}
	/**
	 * @param {string} id
	 * Deployer target id
	 */
	constructor(id, pwa = false) {
		super()
		this.#id = id
		this.#pwa = pwa
		this.update()
	}
	// MessageHub incoming message handler
	onMessage({ id }) {
		if (this.id === id) this.update().catch(CustomError.handler)
	}
	// Try update static file server
	#pwa
	async update() {
		const { id } = this, fd = await Deployer.appData.loadFile(this.identifier, false)
		if (fd instanceof FileDescriptor) {
			const { fileID } = fd, path = Deployer.getDeployPath(fileID)
			await ensureDir(path)
			// Static file server
			const server = express().use(express.static(path))
			// Progressive Web Application
			if (this.#pwa) server.use((req, res, next) => {
				res.sendFile(
					'index.html',
					{ root: path },
					e => { if (e) next(e) }
				)
			})
			if (typeof this.#resolve === 'function') {
				this.#resolve(server)
				this.#resolve = undefined
			}
			this.#server = server
		} else logger.warn(
			`Deployer <${id}> failed to resolve static distribution`
		)
	}
	// Returns computed path according to fileID
	static getDeployPath(fileID) {
		return resolve(PROJECT_ROOT, 'var/deploy/', fileID)
	}
	/**
	 * Register a new deployment
	 * @param {String} id
	 * File upload UUID
	 * @param {*} descriptor
	 * File descriptor for locating the dist file
	 */
	static async register(id, descriptor) {
		const identifier = { deployID: id }
		/**
		 * Get previously loaded deployment files,
		 * and remove them from deployment folder
		 * @type {FileDescriptor[]}
		 */
		const fdList = await Deployer.appData.loadFile(identifier, true)
		await Promise.allSettled(fdList.map(fd => {
			const
				{ fileID } = fd,
				path = Deployer.getDeployPath(fileID),
				cmd = `rm -r ${path}`
			logger.debug(`executing ${cmd}`)
			if (existsSync(path)) return new Promise((res, rej) => {
				exec(cmd, e => { if (e) rej(e); else res() })
			}).catch(CustomError.handler)
		}))
		// Acquire tarball
		const { modifiedCount } = await Deployer.appData.acquireFile(
			descriptor, identifier, { duplicate: false, replace: true }
		)
		if (modifiedCount !== 1) throw new OperationFailedError(
			`Register Deploy <${id}> with ${JSON.stringify(descriptor)}`
		)
		// Expand tarball into dist folder
		const fd = await Deployer.appData.loadFile(identifier),
			{ path, fileID } = fd,
			deployPath = Deployer.getDeployPath(fileID),
			cmd = sl`
				| mkdir -p ${deployPath} &&
				| tar xf ${path} -C ${deployPath}
			`
		logger.debug(`Extracting deployment file: ${cmd}`)
		const output = await new Promise((res, rej) => exec(
			cmd,
			(e, stdout, stderr) => {
				if (e) rej(e)
				else if (stderr) rej(
					new OperationFailedError(`execute ${cmd}`, { stderr })
				)
				else res(stdout)
			}
		))
		logger.debug(`[OUTPUT] ${output}`)
		// Append deployer's userID to VERSION file,
		// which is expected to be in the root of deployment path
		const versionFilePath = resolve(deployPath, 'VERSION'),
			packageStat = await new Promise(res => exec(`stat ${path}`, (e, stdout, stderr) => {
				if (e || stderr) logger.warn(`Error stating deployment package: ${e?.stack || stderr}`)
				else res(stdout)
			}))
		await new Promise(res => appendFile(
			versionFilePath, [
				`[ResourceUUID] ${fileID}`,
				`[DeployUserID] ${fd.userID}`,
				`[DeployTime] ${(new Date).toISOString()}`,
				`[PackageStat] ${packageStat}`,
			].join('\n'),
			err => {
				if (err) logger.warn(`Error appending release info to ${versionFilePath}`)
				res()
			}
		))
		// Log the update
		logger.info(`Deployment applied for ${id}, new resource UUID=${fileID}, details:\n${readFileSync(versionFilePath)}`)
		// Broadcast the update
		return this.sendMessage({ id })
	}
	// AppDataWithFs
	static #appData = new AppDataWithFs('@deployer')
	static get appData() { return this.#appData }
}
