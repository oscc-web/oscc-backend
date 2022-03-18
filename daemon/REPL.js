import 'colors'
import repl from 'repl'
import Session from '../lib/session.js'
import User from '../lib/user.js'
import Group from '../lib/groups.js'
import { AppData, AppDataWithFs } from '../lib/appData.js'
import { PRIV, PRIV_LUT } from '../lib/privileges.js'
import dbInit from '../utils/mongo.js'
import { hash } from '../utils/crypto.js'
import { sendMail } from '../modules/mailer/lib.js'
import { consoleTransport } from '../lib/logger.js'
const rp = repl.start({
	prompt: 'ysyx > ',
	ignoreUndefined: true,
})
rp.on('exit', () => process.exit(0))
rp.defineCommand('help', {
	help: 'Print help message for ysyx-backend-services REPL',
	action(str) {
		this.clearBufferedCommand()
		console.log(HELP_MESSAGE.yellow)
		this.displayPrompt()
	}
})
Object
	.entries({
		Session, User, Group, AppData, AppDataWithFs, consoleTransport, PRIV, PRIV_LUT, sendMail,
		db: dbInit('user/CRUD', 'session/CRUD', 'groups/CRUD', 'appData/CRUD', 'log/CRUD'),
		pwd(str) {
			return hash(str)
		},
	})
	.forEach(([name, value]) => {
		if (typeof value === 'object') value = Object.freeze(value)
		if (typeof value === 'function' && value.length === 0)
			Object.defineProperty(rp.context, name, {
				configurable: false,
				enumerable: true,
				get: value,
			})
		else
			Object.defineProperty(rp.context, name, {
				configurable: false,
				enumerable: true,
				value
			})
	})

const HELP_MESSAGE = `
Help message for ysyx-backend-services
--------------------------------------
Keywords:
  help   	- Show this message
Objects:
  db    	- Database entry point
Available Classes:
  User   	- The core User class
  Session	- Session class
  Group  	- User Group
`.trim()