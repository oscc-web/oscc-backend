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
			'tab',
			{ SwitchCase: 1 }
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
			0,
			{ 'vars': 'all', 'args': 'after-used' }
		],
		'no-cond-assign': [
			0
		],
		'no-control-regex': [0],
		'object-curly-spacing': [
			1,
			'always'
		],
		'comma-spacing': [1],
		'keyword-spacing': [1],
		'arrow-spacing': [1],
		'spellcheck/spell-checker': [
			1,
			{
				'comments': false,
				'strings': false,
				'identifiers': true,
				'templates': false,
				'lang': 'en_US',
				'skipWords': [
					'utils',
					'dists',
					'mongodb',
					'nodebb',
					'wildcard',
					'deployer',
					'satisfiable',
					'unprocessable',
					'jsonwebtoken'
				],
				'skipIfMatch': [
					'http://[^s]*',
					'^[-\\w]+\\/[-\\w\\.]+$',
					'^(\\w+-)+\\w+$$',
					'\\.[cm]?js$',
					'getters?',
					'setters?',
					'std\\w*'
				],
				'skipWordIfMatch': [
					'ysyx',
					'vhost',
					'nodemailer'
				],
				'minLength': 5
			}
		]
	}
}
