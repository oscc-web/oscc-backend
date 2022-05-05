export async function upload() {
	const
		{ AppDataWithFs } = await import('lib/appDataWithFs.js'),
		{ FileDescriptor } = await import('lib/fileDescriptor.js'),
		{ PRIV } = await import('lib/privileges.js'),
		Deployer = (await import('lib/deployer.js')).default,
		userProfile = new AppDataWithFs('user-profile')
	return {
		'/avatar': {
			duplicate: false,
			replace: true,
			// Size limit: 2MB
			maxSize: 2048 * 1024,
			contentType: /^image\/\w+$/gi,
			async hook(req, res, next) {
				const { session: { userID } } = req
				await userProfile.acquireFile(
					{ userID, url: '/avatar' },
					undefined,
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
				const { session: { userID } } = req
				await userProfile.acquireFile(
					{ userID, url: '/resume' },
					undefined,
					{ replace: true }
				)
				await next()
			}
		},
		'/deploy/oscc': {
			duplicate: false,
			replace: true,
			privileges: [PRIV.DEPLOY_HOME],
			maxSize: Infinity,
			contentType: /^application\/tar\+gzip$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await Deployer.register('oscc', { userID, url })
				await next()
			}
		},
		'/deploy/jemu': {
			duplicate: false,
			replace: true,
			privileges: [PRIV.DEPLOY_HOME],
			maxSize: Infinity,
			contentType: /^application\/tar\+gzip$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await Deployer.register('jemu', { userID, url })
				await next()
			}
		},
		'/deploy/home': {
			duplicate: false,
			replace: true,
			privileges: [PRIV.DEPLOY_HOME],
			maxSize: Infinity,
			contentType: /^application\/tar\+gzip$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await Deployer.register('home', { userID, url })
				await next()
			}
		},
		'/deploy/docs': {
			duplicate: false,
			replace: true,
			privileges: [PRIV.DEPLOY_DOCS],
			maxSize: Infinity,
			contentType: /^application\/tar\+gzip$/gi,
			async hook(req, res, next) {
				const { session: { userID }, url } = req
				await Deployer.register('docs', { userID, url })
				await next()
			}
		}
	}
}
