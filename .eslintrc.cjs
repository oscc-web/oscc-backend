const config = {
	env: {
		node: true,
		es2021: true
	},
	extends: 'eslint:recommended',
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	plugins: ['spellcheck'],
	rules: {
		'arrow-spacing': [1],
		'block-spacing': [1],
		'comma-spacing': [1],
		'comma-style': [1],
		'dot-location': [1, 'property'],
		'eol-last': [1],
		'func-call-spacing': [1, 'never'],
		'indent': [1, 'tab', { SwitchCase: 1 }],
		'key-spacing': [1],
		'keyword-spacing': [1],
		'linebreak-style': [2, 'unix'],
		'no-cond-assign': [0],
		'no-control-regex': [0],
		'no-multi-spaces': [1],
		'no-multiple-empty-lines': [1],
		'no-trailing-spaces': [1],
		'no-unused-vars': [0, { 'vars': 'all', 'args': 'after-used' }],
		'no-whitespace-before-property': [1],
		'object-curly-newline': [1, { 'multiline': true, 'consistent': true }],
		'object-curly-spacing': [1, 'always'],
		'operator-linebreak': [1, 'before'],
		'quotes': [1, 'single'],
		'rest-spread-spacing': [1],
		'semi': [1, 'never'],
		'space-before-function-paren': [1, { 'anonymous': 'never', 'named': 'never', 'asyncArrow': 'always' }],
		'space-in-parens': [1],
		'space-infix-ops': [1],
		'space-unary-ops': [1],
		'switch-colon-spacing': [1],
		// Additional config will be appended later
		'spellcheck/spell-checker': [1],
	}
}
// Additional config of spellchecker
config.rules['spellcheck/spell-checker'].push({
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
		'jsonwebtoken',
		'uploader',
		'formatter'
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
})
// export the config
module.exports = config
