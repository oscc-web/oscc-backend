export default {
	mode: 'production', 
	dists: {},
	deployKeys: {
		'*': {
			'xxxx-xxxx-xxxx-xxxx': {
				userName: '',
				deviceName: '',
				report: true
			}
		}
	},
	port: {
		router: 8000,
		deploy: 8999,
		mailer: 8998,
		survey: 8001,
		NodeBB: 4567
	}
}