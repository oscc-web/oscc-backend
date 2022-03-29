// group list
// group detail
// alter user's group
// alter groups privilege
# GroupView API doc

> ### entry condition
> + POST `/groups[/:groupID/*]`

## POST `/groups` - `JSON`

Returns a list of visible group information.
Whether group information is added to the list is according to the group's visibility to this user.
```js
response = {
    // If group's visibility is 'ALL', it would be added to the array.
    groups:{
        // Group ID
        id: String,
        // Group name
        name: String,
        // number of members
        number: Number
    }[]
}
```
## POST `/groups/:groupID` - `JSON`

Return information of Group&lt;groupID&gt;.
Whether group information is visible is according to the group's visibility to this user.
```js
response = {
    members: 
    // Group member information
    {
        // User ID
        id: String,
        // User name
        name: String,
    }[],
    // Description of the group
    details: String | undefined
}
    | '[1] Group not found'
    | '[2] Privilege denied'
```

## POST `/groups/:groupID/update` - `String`

Update information of Group&lt;groupID&gt;.
Group's information can be updated only by user with privilege ALTER_GROUP_PRIVILEGES.
```js
request = {
	// Group name
	name: String | undefined,
	// Privileges will be added to this group
    addPrivileges: String[] | undefined,
    // Privileges will be removed from this group
    removePrivileges: String[] | undefined,
    // Description of the group
    details: String | undefined
}
// The result of operation is indicated by response code.
response = ''
	| '[1] Privilege denied'
	| '[2] Privilege not valid'
 
```