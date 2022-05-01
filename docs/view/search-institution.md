# search-institution API doc

> ### entry condition
> + POST `search-institution`

## POST `search-institution` - `Array`

Returns list of institutions.
The list may vary according to similarity of input and name or ID of institution.

request body needs a text
```js
response = [...{
    // institution's domain name
    _id: String,
    // institution's name like 'xxx University' or {'en-US': 'xxx University'}
    name: String | {
        [localeName]: String
    }
    // similarity of institution and searchString
    score: {
        // if institution's _id or name includes searchString
        included: Boolean,
        // Min string distance between institution's _id or name and searchString
        distance: Number
    }
}]
```