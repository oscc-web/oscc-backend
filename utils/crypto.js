import crypto from 'crypto'
/**
 * Returns hashed string by given method.
 * @param {string} content The string to be hashed
 * @param {string} method Method of hash algorithm
 * @param {string} format Format of final result
 * @returns {string} Hashed content
 */
export function hash(content, method = 'sha256', format = 'hex') {
	return crypto.createHash(method).update(content).digest(format)
}
/**
 * Returns a pair of salted password string and its salt.
 * @param {string} key
 * @param {string} salt
 * @returns {object} keyPair 
 */
export function keyPair(key, salt = seed()) {
	return {
		hash: hash(mix(key, salt), 'sha256', 'hex'),
		salt: salt
	}
}
/**
 * Tests if a given key matches the key pair.
 * @param {object} keyPair 
 * @param {string} key 
 * @returns 
 */
export function testKey(keyPair, key) {
	if (!keyPair || typeof keyPair !== 'object') return false
	// Extract hash and salt from key pair, salt is allowed to be empty
	if (!keyPair.hash || typeof keyPair.hash !== 'string') return false
	return hash(mix(key, keyPair.salt), 'sha256', 'hex') === keyPair.hash
}
/**
 * Returns a pair of salted password string and its salt.
 * @param {string} password
 * @param {string} salt
 * @returns {object} keyPair 
 */
export function mix(password, salt = '') {
	salt = salt.split('').reverse()
	return password.split('').map(c => c + (salt.length > 0 ? salt.pop() : '')).join('')
}
/**
 * Generates random salt seed string.
 */
export function seed(length = 32) {
	let string = ''
	while (string.length < length) {
		string += Math
			.random()
			.toString(36)
			.toUpperCase()
			.replace(/0*\./g, '')
			.padStart(11, '0')
	}
	return string.slice(-length)
}

/**
 * Finds a unique seed that is not existent in given list.
 */
export function uniqSeed(seedList, length = 8) {
	let result
	while ((result = seed(length)) in seedList);
	return result
}