import Enum from 'utils/enum.js'
const _ = new Enum
/**
 * List of all privileges offered in the system.
 * This list can not be modified on the fly.
 */
export const PRIV = Object.freeze({
	// Core user management
	/**
	 * Perform changes on all users.
	 */
	ALTER_USER_INFO: _._,
	/**
	 * Change which groups OTHER USER belongs to.
	 */
	ALTER_USER_GROUP: _._,
	/**
	 * Change the privileges of a certain group.
	 */
	ALTER_GROUP_PRIVILEGES: _._,
	/**
	 * View other users' email. Regardless of their email visibility settings.
	 */
	VIEW_USER_EMAIL: _._,
	// ------------------------------------------------------------------------
	// ysyx.org dynamic contents
	/**
	 * Create, modify and remove dynamic contents.
	 */
	ALTER_HOMEPAGE: _._,
	// ------------------------------------------------------------------------
	// ysyx.org static content deployment
	DEPLOY_HOME: _._,
	DEPLOY_DOCS: _._,
	DEPLOY_APPS: _._,
	DEPLOY_SPACE: _._,
	// ------------------------------------------------------------------------
	// docs.ysyx.org
	/**
	 * View private doc contents.
	 */
	DOCS_PRIVATE_ACCESS: _._,
	// ------------------------------------------------------------------------
	// Application related - Collect Form
	/**
	 * Fill up and submit forms on behalf of him/herself.
	 * Whether a form is displayed to a user is also affected by the general
	 * status of this user, e.g. if a user has already been enrolling in our
	 * program, he will not be offered to submit enrollment form.
	 */
	APP_SUBMIT_FORM: _._,
	/**
	 * Read OTHER USER's form contents.
	 */
	APP_ACCESS_USER_FORM: _._,
	/**
	 * Reply to OTHER USER's form (via email).
	 */
	APP_REPLY_USER_FORM: _._,
	/**
	 * Mark OTHER USER's form as 'approved', 'declined' or 'suspended'.
	 */
	APP_FINALIZE_USER_FORM: _._,
	// ------------------------------------------------------------------------
	// Application related - Progress Report
	/**
	 * Submit progress reports on behalf of him/herself.
	 */
	APP_CREATE_PR: _._,
	/**
	 * Read OTHER USER's progress report content.
	 */
	APP_ACCESS_USER_PR: _._,
	/**
	 * Comment on OTHER USER's progress report.
	 */
	APP_COMMENT_USER_PR: _._,
	/**
	 * Mark OTHER USER's progress report as 'valid' or 'invalid'.
	 */
	APP_MARK_USER_PR: _._,
	// ------------------------------------------------------------------------
	// Third party service: NodeBB
	// entries below will be translated to user groups at NodeBB plugin
	/**
	 * Full access to NodeBB administration features
	 * translates to 'administrators'
	 */
	FORUM_ADMIN: _._,
	/**
	 * Full access to NodeBB post CRUD actions
	 * translates to 'Global Moderators'
	 */
	FORUM_MAINTAINER: _._,
	/**
	 * Post new topics to the forum
	 * translates to 'members'
	 */
	FORUM_CREATE_POST: _._,
	/**
	 * Comment on, up-vote and down-vote forum contents
	 * translates to 'guests'
	 */
	FORUM_COMMENT_AND_VOTE_POST: _._,
})
// Make reverse lookup table from PRIV (id => name)
/**
 * @type {{Number: String}}
 */
export const PRIV_LUT = Object.fromEntries(
	Object.entries(PRIV).map(([_, $]) => [$, _])
)
