import { resolve } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { PROJECT_ROOT } from 'lib/env.js'
import logger from 'lib/logger.js'
const pid_path = resolve(PROJECT_ROOT, 'var/pid')
export function getLock() {
	// Check if a server cluster is currently running
	if (existsSync(pid_path)) {
		let pid = readFileSync(pid_path).toString()
		if (/^[1-9][0-9]*$/g.test(pid)) {
			// Convert pid to an integer
			pid = parseInt(pid)
			// First, test if process exists
			let procExist = false
			try {
				process.kill(pid, 0)
				procExist = true
				// eslint-disable-next-line no-empty
			} catch (e) {}
			// If process exists, send SIGINT
			if (procExist)
				return pid
		}
	}
}
// Terminate existing process and set currentPid as new lock
export async function setLock(currentPid = '') {
	let pid, pending = 0
	// If process exists, send SIGINT
	while (pid = getLock()) {
		if (!pending)
			try {
				if (currentPid)
					logger.info(`Found a running server with pid ${pid}, trying to send SIGINT`)
				const killed = process.kill(pid, 'SIGINT')
				if (!killed) throw new Error('failed to kill existing process')
			} catch (e) {
				logger.error(`Error terminating existing server process [PID=${pid}]: ${e.stack}`)
				process.exit(1)
			}
		else if (pending > 600 /* 60 Seconds */) {
			logger.error('Existing server process took too long to exit, aborting')
			process.exit(1)
		}
		pending ++
		await new Promise(res => setTimeout(res, 100))
	}
	// Save current process's own pid
	try {
		writeFileSync(pid_path, currentPid.toString())
	} catch (e) {
		logger.error(`Error writing PID (${currentPid}) to  '${pid_path}': ${e.stack}`)
		process.exit(1)
	}
}