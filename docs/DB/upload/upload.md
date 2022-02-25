# thoughts on modules/fileSystem

## process of handle request

+ user authentication

	Check cookie.token._int_ui_ in order to ensure user is logged in

+ receive the file

	When the complete file is received, we should return the hash of the file. Database will be queried according to userID and the file is for. If there is a record, The old one will be deleted to ensure each user only has one file with the purpose.

+ change the type of file

	When other processes send request to notify fileSystem which file should be persistent, the database will be updated.

+ clean up temporary files

	Temporary files will  be periodically cleaned up based on which files in the database are temporary.

## `file` database structure

The `file` database stores information of uploaded files.
The primary key is `_id: String`, which stores the file unique identifier.

### List of fundamental file properties

+ userID: String

	It is foreign key to user._id, record which user uploaded the file.

+ type: String: 'temp' | 'persistent' default 'temp'

	It records that the file is a temporary file or a persistent storage.

+ createTime: number

	It records file uploaded time.

+ for: String

	It records the file is for.