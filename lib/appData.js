import dbInit from 'utils/mongo.js'
import { PID } from './env.js'
import CustomObject from 'utils/customObject.js'
// Merge multiple levels of entries into one flattened level
function flatten(obj, prefix = '', target = {}) {
	if (!obj || typeof obj !== 'object') target[prefix] = obj
	else {
		Object.entries(obj).forEach(([key, value]) => {
			const nextPrefix = prefix
				? [prefix, key].join('.')
				: key
			if (value && typeof value === 'object') flatten(
				value,
				nextPrefix,
				target
			)
			else target[nextPrefix] = value
		})
	}
	return target
}
function mergeFilter(target, data, prefix) {
	for (const op in data) {
		target[op] ||= {}
		flatten(data[op], prefix, target[op])
	}
	return target
}
export class AppData extends CustomObject {
	#appID
	get appID() { return this.#appID }
	constructor(appID = PID) {
		super()
		if (!appID || typeof appID !== 'string') throw new Error('Failed to get application unique identifier')
		this.#appID = appID
	}
	// MongoDB Storage
	/**
	 * Store content into appData, content can be located by identifier
	 * @param {Object | String | Number | Boolean} identifier
	 * @param {Object | String | Number | Boolean} content
	 * @param {{
	 * 	replace: Boolean,
	 * 	push: Boolean,
	 * }} args
	 * @returns {Promise<import('mongodb').InsertOneResult | Promise<import('mongodb').UpdateResult>}
	 */
	async store(identifier, content, args = { replace: false, push: false }) {
		// let arr = identifierArr(identifier)
		const query = await this.load(identifier, { duplicate: true })
		let result = null
		if (query.length === 0 || args.replace || args.push) {
			// If replace is enabled and there exists matching entry, drop existing entries.
			if (query.length && args.replace) {
				await this.delete(identifier)
			}
			// Insert new AppData
			result = await AppData.db.appData.insert({ content, identifier, appID: this.appID })
		} else {
			throw new Error(`Store appData identifier <${this.appID}>: ${JSON.stringify(query)}`)
		}
		return result
	}
	/**
	 * Load content and identifier from appData.
	 * @param {Object | String | Number | Boolean} identifier
	 * @param {Boolean} duplicate
	 * @returns {Promise<Object | Object[]>}
	 */
	async load(identifier, { duplicate = false, mix = false } = {}) {
		// let arr = identifierArr(identifier)
		const query = (await AppData.db.appData
			.find({
				...flatten(identifier, 'identifier'),
				appID: this.appID
			})
			.toArray())
			.map(({ content, identifier } = {}) => ({
				...mix ? identifier : {},
				...content
			}))
		return duplicate
			? query
			: query[0]
	}
	/**
	 * Upload content or identifier into appData
	 * @param {Object | String | Number | Boolean} identifier
	 * @param {Object | String | Number | Boolean} [content]
	 * @param {Object} [updateIdentifier]
	 * @returns {Promise<import('mongodb').UpdateResult>}
	 */
	async update(identifier, content = {}, updateIdentifier = {}) {
		const updateFilter = {}
		// Merge content and updateIdentifier into updateFilter
		mergeFilter(updateFilter, content, 'content')
		mergeFilter(updateFilter, updateIdentifier, 'identifier')
		return await AppData.db.appData.update(
			{
				...flatten(identifier, 'identifier'),
				appID: this.appID
			},
			updateFilter
		)
	}
	/**
	 * Delete content from appData specified by identifier
	 * @param {Object | String | Number | Boolean} identifier
	 * @returns {Promise<import('mongodb').DeleteResult>}
	 */
	async delete(identifier) {
		return await AppData.db.appData.delete({
			...flatten(identifier, 'identifier'),
			appID: this.appID
		})
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('appData/CRUD')
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return this.appID }
}
