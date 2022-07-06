# searchUser API doc

> ### entry condition
> + POST `search-user`

## POST `search-institution` - `Array`

Returns list of users.
List may contain users who meet the query criteria.

```js
// If a condition is not given or there are no users matching the condition, the condition will not work.
request = {
    // select users whose ID is in userIDs
    userIDs: String[],
    // sort users with given names
    userNames: String[],
    // select users whose group contains group
    groups: String[],
    // select users whose institution is in institutions
    institutions: String[],
}
response = [...{
    // user's id
    ID: String,
}]
```