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
	institution: String | undefined
}
```

## POST  `/user/:userID/update` - `String`

Update information of User &lt;userID&gt;.
User's information can be updated only by this user and user with privilege ALTER_USER_INFO.
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
		// USer's locale
		language: String
	}
}
// The result of operation is indicated by response code.
response = ''
	// Demo error
	| '[0] This is a demo error message'
	| '[1] Privilege denied'
	| '[2] Token not valid'

```

## GET `/user/:userID/avatar` - `Buffer`
Returns the buffer of this user's avatar