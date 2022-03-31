
export async function upload() {
	const { AppDataWithFs } = await import('lib/appDataWithFs.js')
	const { PRIV } = await import('lib/privileges.js')
	const userProfile = new AppDataWithFs('user-profile')
	return {
		'/avatar': {
			duplicate: false,
			replace: true,
			/**
			 *
			 * @param {import('express').Request} req
			 * @param {import('express').Response} res
			 * @param {Function} next
			 */
			async hook(req, res, next) {
				const { session, url } = req,
					contentType = req.headers?.['content-type']
				let acquireResult
				// Check contentType is image
				if (contentType && contentType.trim().startsWith('image')) {
					acquireResult = await userProfile.acquireFile({ userID: session.userID, url }, { replace: true })
				}
				await next()
			}
		},
		'/resume': { privilege: PRIV.ALTER_GROUP_PRIVILEGES }
	}
}
