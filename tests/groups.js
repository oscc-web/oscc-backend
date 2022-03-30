import Test from './Test.js'
import User from 'lib/user.js'
import Group from 'lib/groups.js'
import { PRIV } from 'lib/privileges.js'
import { seed } from 'utils/crypto.js'
let G = {
		ta: `test-${seed(16)}`,
		web: `test-${seed(16)}`,
		student: `test-${seed(16)}`,
		studentG1: `test-${seed(16)}`,
		invisible: `test-${seed(16)}`
	},
	G_LUT = {
		...Object.fromEntries(Object.entries(G).map(([$, _]) => [_, $])),
		default: 'default',
		guest: 'guest',
		root: 'root',
	},
	/**
	 * root, ta
	 * @type {User}
	 */
	tim,
	/**
	 * student
	 * @type {User}
	 */
	john,
	/**
	 * default (guest)
	 * @type {User}
	 */
	sandy
// Start the test
new Test('create new groups with different privileges')
	.run(async () => {
		await new Group(G.ta, {
			localeName: { 'en': 'ta' },
			privileges: [
				PRIV.DEPLOY_DOCS,
				PRIV.ALTER_GROUP_PRIVILEGES,
				PRIV.ALTER_USER_GROUP,
				PRIV.APP_ACCESS_USER_FORM,
				PRIV.APP_COMMENT_USER_PR
			],
			visibility: 'ALL'
		}).update()
		await new Group(G.student, {
			localeName: { 'en': 'student' },
			privileges: [
				PRIV.APP_CREATE_PR,
				PRIV.APP_SUBMIT_FORM,
				PRIV.FORUM_CREATE_POST,
				PRIV.FORUM_COMMENT_AND_VOTE_POST
			],
			visibility: 'ALL'
		}).update()
		await new Group(G.studentG1, {
			localeName: { 'en': 'studentG1' },
			privileges: [],
			visibility: 'SELF'
		}).update()
		await new Group(G.web, {
			localeName: { 'en': 'web' },
			privileges: [
				PRIV.DEPLOY_HOME,
				PRIV.DEPLOY_APPS,
				PRIV.DEPLOY_DOCS,
				PRIV.DEPLOY_SPACE
			],
			visibility: 'SAME-GROUP'
		}).update()
		await new Group(G.invisible, {
			localeName: { 'en': 'invisible' },
			privileges: [],
			visibility: 'NONE'
		}).update()
	})

new Test('Initiate users with different privileges')
	.run(async () => {
		tim = new User({
			userID: seed(32),
			name: 'tim',
			mail: 'tim@ysyx.demo',
			groups: ['root', G.web]
		})
		john = new User({
			userID: seed(32),
			name: 'john',
			mail: 'john@ysyx.demo',
			groups: [G.student, G.studentG1]
		})
		sandy = new User({
			userID: seed(32),
			name: 'tim',
			mail: 'tim@ysyx.demo',
			groups: ['default', G.invisible, G.web]
		})
		return [tim, john, sandy].map(el => el instanceof User)
	})
	.expect(_ => _.reduce((a, b) => a && b))

new Test('Check privileges for tim (root, web)')
	.run(async () => {
		return await Promise.all([
			PRIV.ALTER_GROUP_PRIVILEGES,
			PRIV.APP_COMMENT_USER_PR,
			PRIV.DEPLOY_APPS,
			PRIV.APP_FINALIZE_USER_FORM
		].map(priv => tim.hasPriv(priv)))
	})
	.expect([true, true, true, true])

new Test('Check privileges for john (student, studentG1)')
	.run(async () => {
		return await Promise.all([
			PRIV.APP_CREATE_PR,
			PRIV.APP_SUBMIT_FORM,
			PRIV.FORUM_CREATE_POST,
			PRIV.FORUM_COMMENT_AND_VOTE_POST,
			PRIV.ALTER_GROUP_PRIVILEGES,
			PRIV.APP_COMMENT_USER_PR,
			PRIV.DEPLOY_APPS,
			PRIV.APP_FINALIZE_USER_FORM
		].map(priv => john.hasPriv(priv)))
	})
	.expect([true, true, true, true, false, false, false, false])

new Test('Check privileges for sandy (default, invisible, web)')
	.run(async () => {
		return await Promise.all([
			PRIV.ALTER_GROUP_PRIVILEGES,
			PRIV.APP_COMMENT_USER_PR,
			PRIV.DEPLOY_APPS,
			PRIV.APP_FINALIZE_USER_FORM
		].map(priv => sandy.hasPriv(priv)))
	})
	.expect([false, false, true, false])

new Test('View tim\'s groups from tim\'s perspective')
	.run(async () => {
		return (await tim.viewGroups(tim)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['root', 'web'].sort())

new Test('View john\'s groups from tim\'s perspective')
	.run(async () => {
		return (await tim.viewGroups(john)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['student', 'studentG1'].sort())

new Test('View sandy\'s groups from tim\'s perspective')
	.run(async () => {
		return (await tim.viewGroups(sandy)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['default', 'invisible', 'web'].sort())

new Test('View tim\'s groups from john\'s perspective')
	.run(async () => {
		return (await john.viewGroups(tim)).map(group => G_LUT[group.id]).sort()
	})
	.expect([].sort())

new Test('View john\'s groups from john\'s perspective')
	.run(async () => {
		return (await john.viewGroups(john)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['student', 'studentG1'].sort())

new Test('View sandy\'s groups from john\'s perspective')
	.run(async () => {
		return (await john.viewGroups(sandy)).map(group => G_LUT[group.id]).sort()
	})
	.expect([].sort())

new Test('View tim\'s groups from sandy\'s perspective')
	.run(async () => {
		return (await sandy.viewGroups(tim)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['web'].sort())

new Test('View john\'s groups from sandy\'s perspective')
	.run(async () => {
		return (await sandy.viewGroups(john)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['student'].sort())

new Test('View sandy\'s groups from sandy\'s perspective')
	.run(async () => {
		return (await sandy.viewGroups(sandy)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['web'].sort())

new Test('View sandy\'s groups from sandy\'s perspective')
	.run(async () => {
		return (await sandy.viewGroups(sandy)).map(group => G_LUT[group.id]).sort()
	})
	.expect(['web'].sort())

new Test('Remove a system group, will throw error')
	.run(async () => {
		return await (await Group.locate('root')).remove()
	})
	.expect(Error)

new Test('Remove a system group, will throw error')
	.run(async () => {
		return await (await Group.locate('root')).remove()
	})
	.expect(Error)


new Test('Test completed, remove all temporary groups')
	.run(async () => {
		return await Promise.all(
			(await Group.locate(Object.values(G))).map(group => group.remove())
		)
	})
	.expect(arr => arr.reduce((a, b) => a && b))
