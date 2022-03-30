# UserView API doc

> ### entry condition
> + POST `/user/:userID[/*]`
> + GET `/user/:userID/avatar`

## POST  `/user/:userID` - `JSON`

Returns information of User &lt;userID&gt;.
The information may vary according to current user's privilege and identity. Only relative and privileged information would be visible.
```js
response = {
	// User name
	name: String,
	// User's email (verified)
	// Visible to: 
	// - user him/herself
	// - user with privilege VIEW_USER_EMAIL
	// - all users, if granted by this user
	mail: String | undefined,
	// User's institution
	// Visible to: 
	// - user him/herself
	// - user with privilege VIEW_USER_INSTITUTION
	// - all users, if granted by this user
	institution: String | undefined,
	// User's description of him/herself
	signature: String | undefined,
	// List of groups that the target user is in,
	// filter by group with visibility to this user
	groups: [...{
        // Group ID
        id: String,
        // Group name
        name: String,
    }]

}
```

## POST  `/user/:userID/update` - `String`

Update information of User &lt;userID&gt;.
User's information can be updated only by this user.
```js
request = {
	// User name
	name: String | undefined,
	// When updating mail, both token and mail must be provided
	// User's email (verified), 
	mail: String | undefined,
	// Token sent to user's email
	token: String | undefined,
	// User's institution
	institution: String | undefined,
	// User preference setting
	setting: {
		// User's locale
		language: String,
		// 0 for accepting all notifications,
		// 1 for only accepting notifications about me
		// 2 for refusing all notifications
		notification: 0 | 1 | 2
	} | undefined
}
// The result of operation is indicated by response code.
response = ''
	// Demo error
	| '[0] This is a demo error message'
	| '[1] Privilege denied'

```

## GET `/user/:userID/avatar` - `Buffer`
Returns the buffer of this user's avatar

## POST `/user/:userID/updateMail`

Update mail of User &lt;userID&gt;.
User's mail can be updated only by this user.
```js
request = {
	// When action is validate,
	// password and new mail is required
	// When action is update,
	// new mail and token is required
	action: 'validate' | 'update'
	// User's password
	password: String | undefined,
	// User's new mail
	mail: String,
	// Token sent to user's new mail
	token:String | undefined
}
// The result of operation is indicated by response code.
response = ''
	// Demo error
	| '[0] This is a demo error message'
	| '[1] Privilege denied'

```