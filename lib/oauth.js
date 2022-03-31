export default class OAuth {
	#GitHub
	#GitLab
	#WeChat
	#Google
	constructor(tokens) {
		if (!tokens || typeof tokens !== 'object') return
		Object.entries(tokens).forEach(([provider, token]) => {
			if (`#${provider}` in this) {
				this[`#${provider}`] = token
			}
		})
	}
}
