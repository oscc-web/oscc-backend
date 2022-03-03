# `login` api description

`/login` is the interface for existing users login.
Method POST will be accepted.
A new session will be created for the user who has successfully logged in.

## `login` input: Object

contained properties:


+ `userID`: String

    unique identifier for user
    regex: /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/

+ `mail`: String

    unique identifier for user
    Regex: /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/

At least one of userID and mail is not null.
They are used to locate an existing user.

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
redirect to index

# `register` api description

`/register` is the interface for new user registration.
Method POST and GET will be accepted.

## `register` with `GET` method

+ `url contains query string`: 

    Query string contains two params: `token` and `mail`(base64)
    Token and mail will be checked if matched in database.
    Matched: redirect to register form page
    Not matched: returns { valid: false, msg: String }

+ `url does not contain query string`: 

    next()

## `register` with `POST` method

contained properties:

+ `action`: String 'VALIDATE_MAIL' | 'VALIDATE_USER_ID' | 'REGISTER'

    + `VALIDATE_MAIL`: 

        Check if mail is valid or registered
        If valid, validateEmail with registration link will be sent to given mail. Mail and generated token will be stored. Returns {valid: true}
        If not, returns {valid:false, msg: String}
    
    + `VALIDATE_USER_ID`: 

        Check if userID is valid or registered
        If valid, returns {valid: true}
        If not, returns {valid:false, msg: String}

    + `REGISTER`
 
        Firstly, check if token is valid
        If not, returns {valid:false, msg: String}
        Secondly, check if mail and userID are valid or registered
        If not, returns {valid:false, msg: String}
        Then, check if name is valid
        If not, returns {valid:false, msg: String}
        Last, create a User instance and registration success email will be sent to given mail. AppData with mail and token will be deleted.Returns {valid: true}

+ `userID`: String

    not null
    unique identifier for user
    regex: /^[a-zA-Z][a-zA-Z0-9\-_]{4,15}$/

+ `mail`: String

    not null
    unique identifier for user
    Real email address provided by user.
    Encoding: base64
    When transferred to utf-8, it can match Regex: /^\w+(\w+|\.|-)*\w+@([\w\-_]+\.)+[a-zA-Z]{1,3}$/

+ `name`: String

    not null
    user's real name

+ `token`: String

    not null
    the token has been sent to user's mail

+ `password`: String

    User login password
    not null

+ `OAuthTokens`: Object

    The token returned when the third party logs in
    key: third party name
    value: token

    Example:

    ```js
        'OAuthTokens' :{
            'github': 'QNH3Q00CMTRNOVJO4GID8SYM'
        }
    ```
