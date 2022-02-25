import dbInit from '../utils/mongo.js'
import PRIV from './privileges.js'
import { logger } from './env.js'
// Make reverse lookup table from PRIV (id => name)
/**
 * @type {{Number: String}}
 */
const PRIV_LUT = Object.fromEntries(
	Object.entries(PRIV).map(([_, $]) => [$, _])
)
// The group class
export default class Group {
	#id
	get id() { return this.#id }
	// Locale name, eg {'en-us': 'XXX'}
	#localeName = {}
	get localeName() { return this.#localeName || {} }
	set localeName(value) {
		if (!value || typeof value !== 'object') throw new TypeError
		this.#localeName = value
	}
	get name() { return { ...this.#localeName, id: this.#id } }
	// Visibility, see docs/groups.md
	/**
	 * @type {'NONE' | 'SELF' | 'SAME-GROUP' | 'ALL'}
	 */
	#visibility
	/**
	 * @type {'NONE' | 'SELF' | 'SAME-GROUP' | 'ALL'}
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
	get privileges() { return [...this.#privileges] }
	get privilegeStrings() { return this.#privileges.map(id => PRIV_LUT[id]) }
	/**
	 * constructor
	 * @param {String} id 
	 * @param {{
	 * 	visibility: 'NONE' | 'SELF' | 'SAME-GROUP' | 'ALL'
	 * }} desc 
	 */
	constructor(id, { privileges = [], localeName = {}, visibility = 'SELF' }) {
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
				return (groups.map(group => group?.id)).indexOf(this.id) >= 0
			case 'ALL':
				return true
			default:
				return false
		}
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
	 * @returns {import('mongodb').UpdateManyResult | import('mongodb').InsertOneResult}
	 */
	async update(updateFilter) {
		if (updateFilter && typeof updateFilter === 'object') {
			return await Group.db.groups.update({ _id: this.id }, updateFilter)
		} else {
			const groupDsc = {
				_id: this.id,
				privileges: this.privilegeStrings,
				localeName: this.localeName,
				visibility: this.visibility
			}
			// Check if this group exists in database
			let [result] = await Group.db.groups.find({ _id: this.id }).toArray()
			// If group exists in the database, do full update
			if (result) return await this.update({ $set: groupDsc })
			// Otherwise, insert a fresh group record
			return await Group.db.groups.insert(groupDsc)
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
		return await Group.db.groups
			.delete({ _id: this.id })
			.then(({ acknowledged, deletedCount }) => {
				return this.#removed = acknowledged && deletedCount === 1
			})
	}
	// Static 
	/**
	 * Get group instances from strings of group name
	 * If there were
	 * @param  {String | String[]} arg
	 * @returns {Promise<(SystemGroup | Group)[]]> | Promise<SystemGroup | Group>}
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
			let group = await SystemGroup.locate(id)
			if (group instanceof Group) return group
			let [groupDsc] = await Group.db.groups.find({ _id: id }).toArray()
			if (groupDsc && typeof groupDsc === 'object') return new Group(id, groupDsc)
			// Return 'default' group
			return await SystemGroup.locate()
		}
		// Check if arg if a valid array
		if (!Array.isArray(arg)) return await SystemGroup.locate()
		// For multiple group queries, filter out SystemGroups and make a batch query.
		// First, instantiate system groups
		arg = await Promise.all(
			arg.map(async id => (await SystemGroup.locate(id)) || id)
		)
		// Then, batch query all remaining groups
		let query = arg
				.filter(el => (el && typeof el === 'string'))
				.map(_id => ({ _id })),
			groupDscs = query.length
				? await Group.db.groups.find({ $or: query }).toArray()
				: []
		// Get the combination of SystemGroups and normal groups
		let result = [
			// System Groups
			...arg.filter(group => group instanceof SystemGroup),
			// Ordinary groups
			...groupDscs.map(({ _id, ...dsc }) => new Group(_id, dsc))
		]
		return result.length ? result : [await SystemGroup.locate()]
	}
	// Lazy-loaded database connection
	static $db
	static get db() {
		return this.$db ||= dbInit('groups/CRUD')
	}
	// Object naming rules
	get [Symbol.toStringTag]() {
		return `${this.constructor.name} <${this.#id}>`
	}
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
		if (id && typeof id === 'string' && (id = id.toLowerCase()) in this.#list)
			try {
				return await this.#list[id]
			} catch (e) {
				logger.error('Error initiating system group', e)
				return new SystemGroup('default')
			}
		return null
	}
	static #list = {
		get root() {
			return Group.db.groups
				.find({ _id: 'root' })
				.toArray()
				.then(([{ localeName, visibility = 'SAME-GROUP' } = {}]) =>
					new class extends SystemGroup {
						constructor() {
							super('root', { localeName, visibility })
						}
						/**
						 * Root user has privilege to everything
						 * @returns {true}
						 */
						hasPriv() {
							return true
						}
						// Ignore any attempts to change root privilege
						async addPriv() { throw new Error('Cannot alter root privilege') }
						async removePriv() { throw new Error('Cannot alter root privilege') }
					})
		},
		get default() {
			return Group.db.groups
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
			return Group.db.groups
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
}