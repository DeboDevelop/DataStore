# DataStore

DataStore is hybrid database and memory cache. It stores data as key-value pair in files. However, it also maintains an LRU cache for fast data retrieval. It also has a TTL(Time To Live) feature using which data can have a expire time. The data will expire after certain no. of seconds. It can be used as a local storage for backend more specifically node server.

[![Build Status](https://travis-ci.com/DeboDevelop/DataStore.svg?branch=main)](https://travis-ci.com/DeboDevelop/DataStore)

## Features

-   The Database is sharded into 10 files. A Hash function will generate a hash for teh key using which a particular shard will be selected.

-   A LRU cache has been maintained. It a data is found in LRU cache, it will be retrieved immediately, otherwise read operation will occur in file.

-   TTL also known as Time To Live feature which lets user delete data after a certain period of time. All the user have to do is mention the no. of seconds after which the data will be deleted.

-   If the server/process goes down, then after restarting the server, the files and folder will automatically be detected and retrived.

-   It the server goes down after the TTL for a key is activated and it comes back up after the key's expire time has passed then, it will be treated as outdated key and it will be immediately deleted.

-   This package has been exposed as a library and can be used in any node backend as long as the index file and it's dependencies are there.

-   This package is thread safe so functions are executed concurrectly. If a shared resource is contested my 2 concurrent function then one of them would be put to sleep. The shared resource here is file/shards so if 2 concurrect function tries to read & write the same file at the same time then one of them would be put to sleep.

-   Key must be string and value must be JSON. Key is capped at 32 character and value has been capped at 16 KB.

-   The Database has been capped at 1 GB.

## Requirement

node v15.4.0 or above.

npm v7.0.15 or above.

## How to get started.

1. Clone the repository and put the index.js somewhere, where you want to use it.

2. Install the Dependencies.

3. Import the library

4. Use the Library

## How to use the library

Import the Library

```
const Database = require("./index");
```

Create some object of the the database class. The Object will accept the name of the datbase and an optional path. Always give the absolute path. If no path or invalid path is given then, it will default to currect directory.

```
let database = new Database("Database name");
```

or

```
let database = new Database("Database name", "/something/something/")
```

Create some data using the createData method. It always returns a promise. Key must be string and and value must be JSON. Key must be string and value must be JSON. Key is capped at 32 character and value has been capped at 16 KB. The Database has been capped at 1 GB. It this requirements are not meet then the promise will be rejected. 3rd parameter is optional, it is for TTL feature if you want to use it.

```
let key = "123456";
let value = {
    read: "Write",
    Music: "Melody",
};
```

```
let d1 = database.createData(key, value)
d1.then(res => {
    //do something
}).catch(err => {
    //do something
});
```

or

```
let d1 = database.createData(key, value, 10)
d1.then(res => {
    //do something
}).catch(err => {
    //do something
});
```

or

```
async function func() {
    try {
        let d1 = await database.createData(key, value)
        //do somthing
    } catch(err) {
        //do something
    }
}
```

or

```
async function func() {
    try {
        let d1 = await database.createData(key, value, 10)
        //do somthing
    } catch(err) {
        //do something
    }
}
```

Create data using the readData function. It only takes the 1 parameter that is key and always returns Promise. Key must be string and must exist in the database, otherwise promise will be rejected.

```
let d1 = database.readData(key)
d1.then(res => {
    //do something
}).catch(err => {
    //do something
});
```

or

```
async function func() {
    try {
        let d1 = await database.readData(key)
        //do somthing
    } catch(err) {
        //do something
    }
}
```

Delete data using the deleteData function. It only takes the 1 parameter that is key and always returns Promise. Key must be string and must exist in the database, otherwise promise will be rejected.

```
let d1 = database.deleteData(key)
d1.then(res => {
    //do something
}).catch(err => {
    //do something
});
```

or

```
async function func() {
    try {
        let d1 = await database.deleteData(key)
        //do somthing
    } catch(err) {
        //do something
    }
}
```

And that's it. Enjoy.

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details

# Author

[Debajyoti Dutta](https://github.com/DeboDevelop)
