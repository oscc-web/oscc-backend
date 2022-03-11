# `login` api description

`/login` is the interface for existing users login.
Method POST will be accepted.
A new session will be created for the user who has successfully logged in.

## `login` input: Object

contained properties:

+ `id` : String
    userID or mail 
    userID: regex: /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/
    mail: regex: /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/

+ `password`: String

    The password filled in by the user when registering.

## `login` output 

+ `{login: false}`:

    User located by id or mail does not exist

    Given password does not match

+ `{"login": true, userInfo: String}`

    Successfully login
    userInfo is a JSON string containing basic user information

# `logout` api description

`/logout` is the interface for existing users logout.
Method GET will be accepted.
The session located by the request will be dropped.

# `register` api description

`/register` is the interface for new user registration.
Method POST and GET will be accepted.

## `register` with `GET` method

    Jump to home page

## `register` with `POST` method

contained properties:

+ `action`: String 'VALIDATE_MAIL' | 'VALIDATE_USER_ID' | 'VALIDATE_TOKEN' | 'REGISTER'

    + `VALIDATE_MAIL`: 

        Check if mail is valid or registered
        If valid, validateEmail with registration link will be sent to given mail. Mail and generated token will be stored. Returns {valid: true}
        If not, returns {valid:false, msg: String}
    
    + `VALIDATE_USER_ID`: 

        Check if userID is valid or registered
        If valid, returns {valid: true}
        If not, returns {valid:false, msg: String}

    + `VALIDATE_TOKEN`:

        Token and mail will be checked if matched in database.
        Matched: returns {valid: true}
        Not matched: returns { valid: false, msg: String }

    + `REGISTER`

        A new user will be created according to userID, mail, name, password

        If successfully registered, returns {valid: true}
        If not, returns {valid: false, msg: String}
        conditions: 
        + `token and mail do not match` returns { valid: false, msg: 'Invalid token' }
        + `invalid userID` returns {valid: false, msg: 'Invalid userID'}
        + `repeated userID`  returns {valid: false, msg: 'userID has already been registered'}
        + `invalid name and password` returns {valid: false, msg: 'Name and password must be strings'}

+ `userID`: String

    not null
    unique identifier for user
    regex: /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/

+ `mail`: String

    not null
    unique identifier for user
    Real email address provided by user.
    regex: /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/

+ `name`: String

    not null
    user's real name

+ `token`: String

    not null
    the token has been sent to user's mail

+ `password`: String

    User login password
    not null
