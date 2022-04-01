export async function upload() {
	const
		{ AppDataWithFs } = await import('lib/appDataWithFs.js'),
		{ FileDescriptor } = await import('lib/fileDescriptor.js'),
		{ PRIV } = await import('lib/privileges.js'),
		userProfile = new AppDataWithFs('user-profile')
	return {
		'/avatar': {
			duplicate: false,
			replace: true,
			// Size limit: 2MB
			maxSize: 2048 * 1024,
			contentType: /^image\/\w+$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await userProfile.acquireFile(
					{ userID, url },
					{ replace: true }
				)
				await next()
			}
		},
		'/resume': {
			duplicate: false,
			replace: true,
			// Size limit: 5MB
			maxSize: 5120 * 1024,
			contentType: /^application\/pdf$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await userProfile.acquireFile(
					{ userID, url },
					{ replace: true }
				)
				await next()
			}
		},
		'/deploy': {
			duplicate: false,
			replace: true,
			// Size limit: 5MB
			maxSize: 5120 * 1024,
			contentType: /^application\/pdf$/gi,
			async hook(req, res, next) {
				const { session, pathMatch: { url } } = req, user = await session
				// TODO: Transfer file to deployer
				await next()
			}
		}
	}
}
