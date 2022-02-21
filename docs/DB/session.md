# `session` database structure
The `session` database stores the session data when users connect to the server.
The primary key is `_id: String`, which stores the session unique identifier.

## List of fundamental session properties

+ `userID`: String

    It is foreign key to user._id, each session is bind to a user.

+ `createTime`: number

    It is the timestamp when the session is created.

+ `expireTime`: number

    It is the timestamp when the session is expired.

+ `language`: String

    It records the locale.

    Example: `zn-CN`, `en-US`

+ `loginMethod`: String

    It records how user log in the website.

    Example: `ysyx.org`, `github.com`

+ `deviceDescriptor`: JSON Object

    If this property is empty, the session is a webSession, else it is a persistentSession.
    The property records the device information of user, such as browser, os, deviceID, deviceModel, os and some other optional properties.

    Example:

    ```js
        {
            'browser': 'chrome',
            'deviceID': '00-16-EA-AE-3C-40',
            'os': 'windows'
        }
    ```
