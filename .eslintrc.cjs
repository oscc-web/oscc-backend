module.exports = {
	'env': {
		'node': true,
		'es2021': true
	},
	'extends': 'eslint:recommended',
	'parserOptions': {
		'ecmaVersion': 'latest',
		'sourceType': 'module'
	},
	'plugins': [
		'spellcheck'
	],
	'rules': {
		'linebreak-style': [
			2,
			'unix'
		],
		'indent': [
			1,
			'tab'
		],
		'quotes': [
			1,
			'single'
		],
		'semi': [
			1,
			'never'
		],
		'no-unused-vars': [
			1,
			{ 'vars': 'all', 'args': 'after-used' }
		],
		'spellcheck/spell-checker': [
			1,
			{
				'comments': true,
				'strings': false,
				'identifiers': true,
				'templates': false,
				'lang': 'en_US',
				'skipWords': [
					'req',
					'res',
					'utils',
					'dists',
					'acc'
				],
				'skipIfMatch': [
					'http://[^s]*',
					'^[-\\w]+\\/[-\\w\\.]+$',
					'^(\\w+-)+\\w+$$'
				],
				'skipWordIfMatch': [
					'ysyx',
					'vhost'
				],
				'minLength': 3
			}
		]
	}
}
