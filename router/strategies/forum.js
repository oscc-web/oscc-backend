import { config } from '../../lib/env.js'
import { PRIV } from '../../lib/privileges.js'
import Session from '../../lib/session.js'
import jsonwebtoken from 'jsonwebtoken'

export const forumGroupPrivLUT = Object.freeze([
	[PRIV.FORUM_ADMIN, 'administrators'],
	[PRIV.FORUM_MAINTAINER, 'Global Moderators'],
	[PRIV.FORUM_CREATE_POST, 'members'],
	[PRIV.FORUM_COMMENT_AND_VOTE_POST, 'guests']
])

export default async function (req, res, next) {
	return await Session.locate(req).then(session => {
		if (session instanceof Session) {
			const header = {
					'alg': 'HS256',
					'typ': 'JWT'
				},
				userData = {
					...session.user.info,
					id: session.userID,
					groups: []
				}
			forumGroupPrivLUT.forEach(([priv, groupName]) => {
				if (session.user.hasPriv(priv)) {
					userData.groups.push(groupName)
				}
			})
			const secret = config?.nodebb?.secret || ''
			req.injectCookies({
				token: jsonwebtoken.sign(userData, secret, { header })
			})
		}
		next()
	})
}