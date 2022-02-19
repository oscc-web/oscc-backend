# `User` database structure

The `User` database stores users data.
The primary key is `_id:String`, which stores the user unique identifier.

## List of fundamental user properties

	These properties can not be empty.

+ `name`: String

	Usually it is true name. Visible to other users.

+ `mail`: String

	The property must be unique. We can identify users by email.
	Mail will be converted to lowercase.

+ `password`: JSON Object

	An object contains a list of objects with different hash and salt. 
	The hash comes from original password and salt. 

	Example:

	```js
	{
		'mail': {
			'hash':'ASDHJASDHAJSD',
			'salt':'salt0'
		},
		'id': {
			'hash':'GDFDFADSADSSD',
			'salt':'salt1'
		},
	}
	``` 

+ `groups`: Array

	Indicate which user groups the user is in and which permissions they have.
	Details according to [groups.md](./groups.md)

+ `webRoot`: Boolean

## List of optional user properties

	These properties can be empty.

+ `cell`

+ `school`

+ `major`

