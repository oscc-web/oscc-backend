import CustomObject from 'utils/customObject.js'
import dbInit from 'utils/mongo.js'
import logger from './logger.js'
import { PRIV, PRIV_LUT } from './privileges.js'

/**
 * @typedef {'en' | 'en-US' | 'zh' | 'zh-CN'} Locale
 */
/**
 * @typedef {'NONE' | 'SELF' | 'SAME-GROUP' | 'ALL'} Visibility
 */
/**
 * @typedef {Object} GroupDescriptor
 * @property {(Number | String)[]} privileges
 * List of privileges for the current group
 * @property {Visibility} visibility
 * Whether the group is visible to the viewer
 * @property {Object.<string, string>} localeName
 * Optional locale names to use
 */
// The group class
export default class Group extends CustomObject {
	#id
	get id() { return this.#id }
	// Locale name, eg {'en-us': 'XXX'}
	#localeName = {}
	get localeName() { return this.#localeName || {} }
	set localeName(value) {
		if (!value || typeof value !== 'object') throw new TypeError
		this.#localeName = value
	}
	get name() { return this.#localeName }
	// Visibility, see docs/groups.md
	/**
	 * @type {Visibility}
	 */
	#visibility
	/**
	 * @type {Visibility}
	 */
	get visibility() { return this.#visibility || 'SELF' }
	set visibility(value) {
		if (typeof value !== 'string') throw new TypeError
		value = value.toUpperCase()
		if (['NONE', 'SELF', 'SAME-GROUP', 'ALL'].indexOf(value) < 0) throw new TypeError
		this.#visibility = value
	}
	// Array of privilege identifiers (Numbered enum)
	#privileges = []
	/**
	 * @type {Number[]}
	 */
	get privileges() { return [...this.#privileges] }
	get privilegeStrings() { return this.#privileges.map(id => PRIV_LUT[id]) }
	set privileges(privList) {
		const privileges = privList
			.map(priv => {
				if (typeof priv === 'number' && priv in PRIV_LUT) return priv
				else if (priv in PRIV) return PRIV[priv]
				else return undefined
			})
			.filter(priv => priv !== undefined)
		this.update({ $set: privileges })
		this.#privileges = privileges
	}
	/**
	 * @type {GroupDescriptor}
	 */
	get descriptor() {
		return {
			privileges: this.privilegeStrings,
			localeName: this.localeName,
			visibility: this.visibility
		}
	}
	/**
	 * Constructor
	 * @param {String} id
	 * @param {GroupDescriptor} dsc
	 */
	constructor(id, { privileges = [], localeName = {}, visibility = 'SELF' }) {
		super()
		this.#id = id
		this.#localeName = localeName
		this.visibility = visibility
		privileges.forEach(claim => {
			if (typeof claim === 'number' && claim in PRIV_LUT) this.#privileges.push(claim)
			else if (typeof claim === 'string' && claim in PRIV) this.#privileges.push(PRIV[claim])
			else {
				logger.error(`Encountered unknown privilege ${claim} during group initialization`)
			}
		})
	}
	/**
	 * Check if this group has given privilege
	 * @param {PRIV | String} priv Indexed enum PRIV[xxx]
	 * @returns {Boolean}
	 */
	hasPriv(priv) {
		if (typeof priv === 'number') return this.#privileges.indexOf(priv) >= 0
		else if (typeof priv === 'string' && priv in PRIV) return this.hasPriv(PRIV[priv])
		return false
	}
	/**
	 * Check if another user can view this group
	 * @param  {boolean} self Whether the view request came from user himself
	 * @param  {...Group} groups
	 */
	hasView(self, ...groups) {
		switch (this.visibility) {
			case 'NONE':
				return false
			case 'SELF':
				return !!self
			case 'SAME-GROUP':
				return groups.map(group => group?.id).indexOf(this.id) >= 0
			case 'ALL':
				return true
			default:
				return false
		}
	}
	/**
	 * Checks if user's privilege fully covers this group
	 * @param {import('lib/user.js').default} user
	 * @returns {Boolean}
	 * The challenge result
	 */
	challenge(user) {
		return Group.challenge(this, user)
	}
	/**
	 * Add privileges to a group
	 * @param {PRIV | String} priv Indexed enum PRIV[xxx]
	 * @returns {UpdateManyResult}
	 */
	async addPriv(...args) {
		// Convert privileges to numeric enum and insert them to this.#privileges
		args
			.map(priv => typeof priv === 'string' ? PRIV[priv.toUpperCase()] : parseInt(priv))
			.filter(priv => priv in PRIV && this.privileges.indexOf(priv) < 0)
			.forEach(priv => this.#privileges.push(priv))
		// Return database update query result
		return await this.update({ $set: { privileges: this.privilegeStrings } })
	}
	/**
	 * Remove privileges from a group
	 * @param {PRIV | string} args Indexed enum PRIV[xxx]
	 * @returns {UpdateManyResult}
	 */
	async removePriv(...args) {
		// Convert privileges to numeric enum and insert them to this.#privileges
		const filter = args.map(priv => typeof priv === 'string' ? PRIV[priv.toUpperCase()] : parseInt(priv))
		// Filter any existing privileges included in 'filter'
		this.#privileges = this.#privileges.filter(el => filter.indexOf(el) < 0)
		// Return database update query result
		return await this.update({ $set: { privileges: this.privilegeStrings } })
	}
	/**
	 * Set and update the locale name of this group
	 * @param {PRIV | String} priv Indexed enum PRIV[xxx]
	 * @returns {UpdateManyResult}
	 */
	async setLocaleName(localeName) {
		this.localeName = localeName
		// Illegal input will throw error, and will therefore terminate control
		// flow before it reaches here
		return await this.update({ $set: { localeName } })
	}
	/**
	 * Update local copy of privileges to database
	 * @returns {Promise<import('mongodb').UpdateManyResult | import('mongodb').InsertOneResult>}
	 */
	async update(updateFilter) {
		const self = { _id: this.id }, [query] = await Group.db.find(self).toArray()
		if (updateFilter && typeof updateFilter === 'object') {
			// Check if there exists a database record
			// Insert the record if missing record
			if (!query) await this.update()
			// Do the update according to custom update filter
			return await Group.db.update({ _id: this.id }, updateFilter)
		} else {
			// Check if this group exists in database
			// If does not exist, do full update
			if (query) return await this.update({ $set: this.descriptor })
			// Otherwise, insert a fresh group record
			else return await Group.db.insert({ ...this.descriptor, ...self })
		}
	}
	/**
	 * Remove both local and remote group
	 * @returns {import('mongodb').UpdateManyResult | import('mongodb').InsertOneResult}
	 */
	#removed = false
	get removed() { return this.removed }
	/**
	 * Remove the group from
	 * @returns {Promise<Boolean>}
	 */
	async remove() {
		return await Group.db
			.delete({ _id: this.id })
			.then(({ acknowledged, deletedCount }) => {
				return this.#removed = acknowledged && deletedCount === 1
			})
	}
	// Static
	/**
	 * Get group instances from strings of group name
	 * @param  {String | String[]} arg
	 * @returns {Promise<SystemGroup[] | Group[] | SystemGroup | Group>}
	 * Specially, if an Array is given as argument and none of them can be matched,
	 * system group 'default' will be returned as the only element of Array
	 */
	static async locate(arg) {
		if (!arg || !arg?.length) {
			return Array.isArray(arg)
				? [await SystemGroup.locate()]
				: await SystemGroup.locate()
		}
		// Single group query
		if (typeof arg === 'string') {
			const id = arg
			if (!id || typeof id !== 'string') return null
			const group = await SystemGroup.locate(id)
			if (group instanceof Group) return group
			const [descriptor] = await Group.db.find({ _id: id }).toArray()
			if (descriptor && typeof descriptor === 'object') return new Group(id, descriptor)
			// Return null if non was matched
			return null
		}
		// Check if arg if a valid array
		if (!Array.isArray(arg)) throw new TypeError
		// For multiple group queries, filter out SystemGroups and make a batch query.
		// First, instantiate system groups
		arg = await Promise.all(
			arg.map(async id => await SystemGroup.locate(id) || id)
		)
		// Then, batch query all remaining groups
		const query = arg
				.filter(el => el && typeof el === 'string')
				.map(_id => ({ _id })),
			descriptors = query.length
				? await Group.db.find({ $or: query }).toArray()
				: []
		// Get the combination of SystemGroups and normal groups
		const result = [
			// System Groups
			...arg.filter(group => group instanceof SystemGroup),
			// Ordinary groups
			...descriptors.map(({ _id, ...dsc }) => new Group(_id, dsc))
		]
		// Return default group if there is no matched group
		return result.length ? result : [await SystemGroup.locate()]
	}
	/**
	 * Check if user's privilege fully covers the group
	 * @param {Group} group
	 * @param {import('lib/user.js').default} user
	 * @returns {Boolean}
	 * The challenge result
	 */
	static challenge({ privileges = [] }, user) {
		for (const priv of privileges) {
			if (!user.hasPriv(priv)) return false
		}
		return true
	}
	/**
	 * Get the entire list of group instances
	 * @type {Promise<(Group | SystemGroup)[]>}
	 */
	static get list() {
		return new Promise(res => {
			(async () => {
				const list = (
					await this.db
						.find({}, { projector: { _id: true } })
						.toArray()
				).map(({ _id }) => _id)
				return [
					...(await Promise.all(list.map(id => Group.locate(id))))
						.filter(g => !(g instanceof SystemGroup)),
					...await SystemGroup.list
				]
			})().then(res)
		})
	}
	// Lazy-loaded database connection
	static $db
	/**
	 * @type {import('utils/mongo.js').MongoCollection}
	 */
	static get db() {
		return (this.$db ||= dbInit('groups/CRUD')).groups
	}
	// Object naming rules
	get [Symbol.toStringTag]() { return this.#id }
}
// System groups, cannot be removed, some of them cannot be modified
export class SystemGroup extends Group {
	async remove() {
		throw new Error(`SystemGroup "${this.id}" cannot be removed`)
	}
	/**
	 * Asynchronously locate and construct a system group
	 * @param {String | 'default'} id
	 * @returns
	 */
	static async locate(id = 'default') {
		if (id && typeof id === 'string' && (id = id.toLowerCase()) in this.#list) try {
			return await this.#list[id]
		} catch (e) {
			logger.error('Error initiating system group', e)
			return new SystemGroup('default')
		}
		return null
	}
	static #list = {
		get root() {
			return Group.db
				.find({ _id: 'root' })
				.toArray()
				.then(([dsc = {}]) => new RootSystemGroup(dsc))
		},
		get default() {
			return Group.db
				.find({ _id: 'default' })
				.toArray()
				.then(([{ privileges = [], localeName, visibility = 'NONE' } = {}]) =>
					new SystemGroup(
						'default',
						{ privileges, localeName, visibility }
					)
				)
		},
		get guest() {
			return Group.db
				.find({ _id: 'guest' })
				.toArray()
				.then(([{ privileges = [], localeName, visibility = 'NONE' } = {}]) =>
					new SystemGroup(
						'guest',
						{ privileges, localeName, visibility }
					)
				)
		}
	}
	static get list() {
		return Promise.all(Object.values(this.#list))
	}
}

export class RootSystemGroup extends SystemGroup {
	constructor({ localeName, visibility = 'SAME-GROUP' }) {
		super('root', { localeName, visibility })
	}
	/**
	 * Root user has privilege to everything
	 * @returns {true}
	 */
	hasPriv() {
		return true
	}
	// Override list of privileges
	get privileges() { return Object.values(PRIV) }
	get privilegeStrings() { return Object.keys(PRIV) }
	/**
	 * @type {{
	 * 	privileges: undefined,
	 * 	localeName: Object | String,
	 * 	visibility: Visibility,
	 * }}
	 */
	get descriptor() {
		return {
			localeName: this.localeName,
			visibility: this.visibility
		}
	}
	// Ignore any attempts to change root privilege
	async addPriv() { throw new Error('Cannot alter root privilege') }
	async removePriv() { throw new Error('Cannot alter root privilege') }
}
