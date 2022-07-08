import express from 'express'
import { config, DOMAIN } from 'lib/env.js'
import { PRIV } from 'lib/privileges.js'
import Session from 'lib/session.js'
import withSession from 'lib/middleware/withSession.js'
import proxy from 'lib/middleware/proxy.js'
import logger from 'lib/logger.js'
import { AppDataWithFs } from 'lib/appDataWithFs.js'
import { URL } from 'url'

const appDataWithFs = new AppDataWithFs('user-profile')

export const forumGroupPrivLUT = Object.freeze([
	[PRIV.FORUM_ADMIN, 'administrators'],
	[PRIV.FORUM_MAINTAINER, 'Global Moderators'],
	[PRIV.FORUM_CREATE_POST, 'members'],
	[PRIV.FORUM_COMMENT_AND_VOTE_POST, 'guests']
])

export async function forumPreprocessor(req, res, next) {
	const { session } = req
	if (session instanceof Session) {
		const user = await session.user,
			{ name, mail, userID } = user,
			userData = { userID, name, mail },
			groups = (await Promise.all(forumGroupPrivLUT.map(
				async ([priv, groupName]) => {
					if (await user.hasPriv(priv)) return groupName
					return undefined
				}
			))).filter(group => !!group),
			fd = await appDataWithFs.loadFile({ userID, url: '/avatar' }),
			content = { ...userData, groups, avatar: fd ? `/user/${userID}/avatar?${fd.fileID}` : undefined }
		req.injectInternalCookies({ nodebb: JSON.stringify(content) })
		logger.debug(`Forum preprocessor injected ${JSON.stringify(content)}`)
	}
	return next()
}

export default express()
	.use((req, res, next) => {
		const url = new URL(req.url, `https://${req.headers?.host || 'localhost'}`)
		// eslint-disable-next-line spellcheck/spell-checker
		if (url.pathname.startsWith('/extern/')) {
			url.pathname = url.pathname.replace(/^\/extern/i, '')
			return res.redirect(url.href)
		} else next()
	})
	.use(withSession(forumPreprocessor))
	// Forward processed traffic to real NodeBB service
	.use(proxy(
		config?.port?.NodeBB || 4567,
		{
			cookieFilter(str) {
				return str
					.replace(/path=(\w|\/)+/ig, 'Path=/')
			}
		}
	))
