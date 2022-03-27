import express from 'express'
import jsonwebtoken from 'jsonwebtoken'
import { config } from '../../lib/env.js'
import { PRIV } from '../../lib/privileges.js'
import Session from '../../lib/session.js'
import withSession from '../../lib/middleware/withSession.js'
import proxy from '../../lib/middleware/proxy.js'

export const forumGroupPrivLUT = Object.freeze([
	[PRIV.FORUM_ADMIN, 'administrators'],
	[PRIV.FORUM_MAINTAINER, 'Global Moderators'],
	[PRIV.FORUM_CREATE_POST, 'members'],
	[PRIV.FORUM_COMMENT_AND_VOTE_POST, 'guests']
])

export async function forumPreprocessor(req, res, next) {
	const { session } = req
	if (session instanceof Session) {
		const header = {
				'alg': 'HS256',
				'typ': 'JWT'
			},
			user = await session.user,
			{ name, mail, userID } = user,
			userData = { userID, name, mail },
			groups = []
		forumGroupPrivLUT.forEach(([priv, groupName]) => {
			if (user.hasPriv(priv)) groups.push(groupName)
		})
		const secret = config?.nodebb?.secret || 'forum.ysyx.secret'
		req.injectCookies({
			__internal_nodebb__: jsonwebtoken.sign(
				{ ...userData, groups },
				secret,
				{ header }
			)
		})
	}
	return next()
}

export default express()
	.use(withSession(forumPreprocessor))
	// Forward processed traffic to real NodeBB service
	.use(proxy(config?.port?.NodeBB || 4567))