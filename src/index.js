const fs = require("fs");
const path = require("path");
const lockfile = require("proper-lockfile");
var LRU = require("lru-cache"),
    options = {
        max: 5,
        length: function (n, key) {
            return n * 2 + key.length;
        },
        dispose: function (key, n) {
            n = "";
        },
        maxAge: 1000 * 60 * 60,
    },
    cache = new LRU(options),
    otherCache = new LRU(50);

/**
 * Stores the Config data. The Config data comprises of key of data for which TTL is enabaled.
 * TTL is time to live
 * @type {Array}
 */
let config_data = [];

/**
 * Stores the total size of the database in bytes, it is used to keep the size of database under 1 GB.
 * @type {number}
 */
let size = 0;

/**
 * This function is used to achieve TTL on a certain key.
 * This function should not be directly called and should only be used through createData method of Database class.
 * @param {Object} database - The Database object for which this function is called.
 * @param {string} filename - The file(shard) in which the data is stored
 * @param {string} key - The key of the data which will be deleted.
 * @param {number} seconds - The no. of seconds after which it will be deleted.
 * @returns {void}
 */
function deleteFileAfterSomeTime(database, filename, key, seconds) {
    //get the current tie in miliseconds
    let curr_time = new Date().getTime();
    //storing the file path
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    //creating a config obj to store the meta data of the dat which will be deleted.
    let config_obj = {
        database_name: database.name,
        file_name: filename,
        key: key,
        exp_time: curr_time + seconds * 1000,
    };
    config_data.push(config_obj);
    //Overwriting the Config file after updating config_data variable with new information
    try {
        fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
    } catch (e) {
        console.log("Failed to update the config file due to error");
        console.log(e);
    }
    //Firing Event to delete data after x seconds (where x is user input)
    setTimeout(() => {
        //deleting the data
        let x = database.deleteData(key);
        x.then(res => {
            console.log(key + " is successfully deleted through TTL");
            //console.log(res);
        }).catch(err => {
            console.log(key + " could not be deleted, some error happend");
            console.log(err);
        });
        //Removing the meta data of data that has been deleted from the config file.
        let newArr = config_data.filter(item => item.key != config_obj.key);
        try {
            //rewriting the config file
            fs.writeFileSync(file_p, JSON.stringify(newArr), "utf8");
        } catch (e) {
            console.log("Failed to update the config file due to error");
            console.log(e);
        }
    }, seconds * 1000);
}

/**
 * Check whether the Config file exist or not.
 * @param {string} file_p - path to the config file
 * @returns {boolean} - return whether the file exist or not.
 */
function checkConfigFile(file_p) {
    try {
        //lstatSync is used to get the stats of the path and isFile() is used to check whether it is file or not.
        if (fs.lstatSync(file_p).isFile()) return true;
        else return false;
    } catch (e) {
        //console.log(e);
        //Execution goes to catch block when the file doesn't exist.
        return false;
    }
}

/**
 * Function to create the config file.
 * @param {Object} database - current database object for which we are creating config file.
 */
function createConfigFile(database) {
    //storing the path to the config file
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    try {
        //Checking if the config file exist or not.
        if (checkConfigFile(file_p)) {
            console.log("Config File Exist! Backing the data");
            //Backing up data from config file
            config_data = JSON.parse(fs.readFileSync(file_p, "utf8"));
            //Deleting those data for which have expired but couldnot be deleted due to system crash.
            deleteOutdatedFile(database);
        } else {
            //Creating the config file if no config file exist.
            fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
        }
    } catch (e) {
        //throwing err to stop the system. If anything goes wrong upto this point, further execution should not be possible.
        throw e;
    }
}

/**
 * This function is created to delete those data which have expired but it couldn't be deleted due to system crashes.
 * @param {Object} database - the current database object from which this function is called.
 */
function deleteOutdatedFile(database) {
    console.log("Deleting Outdated Data");
    //storing the path to config file
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    try {
        //getting the current time to check which data has been deleted.
        let curr_time = new Date().getTime();
        let newArr = [];
        //looping through all the data in config variable
        for (let i = 0; i < config_data.length; i++) {
            //Checking whether the data have expired or not.
            if (config_data[i].exp_time < curr_time) {
                //deleting the data if the data has expired.
                let x = database.deleteData(config_data[i].key);
                x.then(res => {
                    console.log(config_data[i].key + " is Outdated so it has been deleted.");
                    //console.log(res);
                }).catch(err => {
                    console.log(config_data[i].key + " is Outdated but couldn't be deleted due to system failure.");
                    console.log(err);
                });
            } else {
                //keeping the data if it haven't expired
                newArr.push(config_data[i]);
            }
        }
        config_data = newArr;
        //re-writing the config data
        fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
    } catch (e) {
        //throwing err to stop the system. If anything goes wrong upto this point, further execution should not be possible.
        throw e;
    }
}

/**
 * Simple hash function to generate a hash from a key.
 * @param {string} key - key that will be hashed
 * @returns {number} - It returns a no. between 0 to 9 depending on the key.
 */
function keyHash(key) {
    let num = 0;
    //Just added the ASCII value of every alternative character of the key
    for (let i = 0; i < key.length; i += 2) {
        num += key.charCodeAt(i);
    }
    return num % 10;
}

/**
 * This function puts a createData process to sleep for 5 seconds.
 * @param {Object} obj - the current database object for which the function has been called.
 * @param {string} key - the key for the data which will be storted in the database.
 * @param {Object} value - the JSON value which will be stored in the database.
 * @param {number} seconds - if TTL is enabled for the data then it contains the no. of seconds otherwise undefined.
 * @returns {Promise} - returns a promise which will be resolved after the createData function is successfully executed.
 */
function sleepProcessCreate(obj, key, value, seconds) {
    console.log(
        "Create data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    //executing createData without seconds variable if seconds is undefined
    if (seconds == undefined) {
        //Wrapping the setTimeout with a promise so taht we can return a promise to the user appropriately.
        return new Promise(function (resolve, reject) {
            setTimeout(() => {
                obj.createData(key, value)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }, 5 * 1000);
        });
    } else {
        //Exexuting createData with second variable since the second variable exist.
        //Wrapping the setTimeout with a promise so taht we can return a promise to the user appropriately.
        return new Promise(function (resolve, reject) {
            setTimeout(() => {
                obj.createData(key, value, seconds)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }, 5 * 1000);
        });
    }
}

/**
 * This function will put a readData process to sleep
 * @param {Object} obj - the current database object for which the function has been called.
 * @param {string} key - the key for the data which will be storted in the database.
 * @returns {Promise} - returns a promise which will be resolved after the readData function is successfully executed.
 */
function sleepProcessRead(obj, key) {
    console.log(
        "Read data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    //Wrapping the setTimeout with a promise so taht we can return a promise to the user appropriately.
    return new Promise(function (resolve, reject) {
        setTimeout(() => {
            obj.readData(key)
                .then(res => resolve(res))
                .catch(err => reject(err));
        }, 5 * 1000);
    });
}

/**
 * This function will put a deleteData process to sleep
 * @param {Object} obj - the current database object for which the function has been called.
 * @param {string} key - the key for the data which will be storted in the database.
 * @returns {Promise} - returns a promise which will be resolved after the deleteData function is successfully executed.
 */
function sleepProcessDelete(obj, key) {
    console.log(
        "Delete data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    //Wrapping the setTimeout with a promise so taht we can return a promise to the user appropriately.
    return new Promise(function (resolve, reject) {
        setTimeout(() => {
            obj.deleteData(key)
                .then(res => resolve(res))
                .catch(err => reject(err));
        }, 5 * 1000);
    });
}

/**
 * A Database Object which create files to store data on the database
 * @param {string} name - Name of the Database
 * @param {string} [file_path] - The path where the data is stored. It's optional and it takes the currect directory by default.
 * @example
 *
 *      let database1 = new Database("Database name");
 *
 * @example
 *
 *      let database2 = new Database("Database name", "/something/something")
 *
 */
class Database {
    constructor(name, file_path = __dirname) {
        this.name = name;
        try {
            //Checking whether the given path exist or not.
            if (fs.lstatSync(file_path).isDirectory() == true) this.file_path = file_path;
            else {
                console.error("Path is not a Directory");
                console.error("Using Default path to save data");
                // Using currect directory if the user given path is not Directory.
                this.file_path = __dirname;
            }
        } catch (e) {
            if (e.code == "ENOENT") {
                console.error("No file or Directory Exist: " + file_path);
                console.error("Using Default path to save data");
                // Using currect directory if the user given path doesn't exist.
                this.file_path = __dirname;
            } else throw e;
        }
        try {
            //Creating the Data Directory where the data will be stored.
            fs.mkdirSync(path.join(this.file_path, "data"));
        } catch (e) {
            //If the data directory exist, then it will be used to store data.
            if (e.code == "EEXIST") console.log("Directory already exist! Data will be saved there.");
            else throw e;
        }
        try {
            //Reading all the files(Shards) if they exist
            for (let i = 0; i < 10; i++) {
                let file_p = path.join(this.file_path, "data", `${i}.json`);
                let value = fs.readFileSync(file_p, "utf8");
                size += Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(`${i}.json`);
            }
        } catch (e) {
            if (e.code == "ENOENT") {
                //Creating the file(Shards) if they doesn't exist
                for (let i = 0; i < 10; i++) {
                    let file_p = path.join(this.file_path, "data", `${i}.json`);
                    fs.writeFileSync(file_p, "{}", "utf8");
                    size += Buffer.byteLength("{}") + Buffer.byteLength(`${i}.json`);
                }
            } else throw e;
            //Throwing the error to stop the creation of Database
        }
        try {
            //Creating the config directory
            fs.mkdirSync(path.join(this.file_path, "config"));
        } catch (e) {
            //If the Config directory exist, it will be used and no need to create another.
            if (e.code == "EEXIST") console.log("Config Directory Exist");
            else throw e;
            //Throwing the error to stop the creation of Database
        }
        //Calling function to craete config file.
        createConfigFile(this);
    }
    /**
     * This function exist whether the given file exist or not. Very useful to check if somebody deleted a shard.
     * @param {string} file_name - the name of the file which this function will check.
     * @returns {boolean} - return true if file exist else false
     *
     * @example
     *
     *      let bool = database.fileExist("0.json");
     *
     */
    fileExist(file_name) {
        //storing the path to the file.
        let file_p = path.join(this.file_path, "data", file_name);
        try {
            //lstatsSync is used to get the details of the path and isFile() is used to check whether the path is of a file or not.
            if (fs.lstatSync(file_p).isFile()) return true;
            else return false;
        } catch (e) {
            //console.log(e);
            return false;
        }
    }
    /**
     * This function is used by the user to create data.
     * @param {string} key - The key of the corresponding value. Must be String.
     * @param {object} value - The value of the given string. Must be JSON.
     * @param {number} [seconds] - Optional seconds parameter for the TTL feature.
     * @returns {Promise} - Returns a Promise which will resolve when the data has been written in the file.
     *
     * @example
     *
     *      let d1 = database.createData("someKey", someValue, [someSeconds])
     *      d1.then(res => {
     *          //do something
     *      }).catch(err => {
     *          //do something
     *      });
     *
     * @example
     *
     *      async function func() {
     *          try {
     *              let d1 = await database.createData("someKey", someValue, [someSeconds])
     *              //do somthing
     *          } catch(err) {
     *              //do something
     *          }
     *      }
     *
     */
    createData(key, value, seconds = undefined) {
        //Check whether the size of the database is under 1 GB or not.
        if (size >= 1024 * 1024 * 1024) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Size of Database is more than 1 GB, please delete some files." });
            });
        }
        // Check whether key is string or not.
        if (typeof key !== "string") {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        // Check whether value is null or not. (since null is treated as object in JS)
        if (value === null) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value is Null" });
            });
        }
        // Check whether the value is JSON or not
        if (typeof value !== "object") {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value have to be JSON" });
            });
        }
        // Check whether the key is under 32 characters or not.
        if (key.length > 32) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key is more than 32 characters." });
            });
        }
        // Check whether the values is under 16 KB or not.
        if (Buffer.byteLength(JSON.stringify(value)) > 16 * 1024) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value is more than 16 KB." });
            });
        }
        try {
            //Generating the Hash for the key
            let key_hash = keyHash(key);
            //console.log(this.name + " : " + key_hash);
            //checking whether the file data exist in LRU cache or not. It it exist, storing the data otherwise undefined.
            let file_obj = cache.get(`${key_hash}.json`);
            //storing the file path
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            //Checking whether file/shard has been deleted or not.
            if (this.fileExist(`${key_hash}.json`) == false) {
                //returning appropriate promise
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            //if the data doesn't exist in LRU Cache the it is read from the file.
            if (file_obj == undefined) {
                file_obj = JSON.parse(fs.readFileSync(file_p, "utf8"));
                //putting the data into teh LRU Cache
                cache.set(`${key_hash}.json`, file_obj);
            }
            //Checking whether there is an exsisting key or not.
            if (file_obj.hasOwnProperty(key)) {
                //returning appropriate promise
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "Key already exist." });
                });
            } else {
                //creating the new key value pair
                file_obj[key] = value;
                //updating the size variable
                size += Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(key);
                //putting the data in LRU cache
                cache.set(`${key_hash}.json`, file_obj);
                //this can't be used in Promises so storing this in a variable.
                let curr_obj = this;
                return new Promise(function (resolve, reject) {
                    //Locking the file for write operation
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            //Writing the data n the file
                            fs.writeFile(file_p, JSON.stringify(file_obj), "utf8", err => {
                                if (err) reject(err);
                                else {
                                    if (seconds !== undefined) {
                                        //calling the function if TTL is given for the key
                                        deleteFileAfterSomeTime(curr_obj, key_hash, key, seconds);
                                    }
                                    //resolving the promise
                                    resolve({ status: "Sucess", msg: "File is Created Successfully." });
                                }
                            });
                            //releasing the lock on the file
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                //Putting the currect operation to sleep as another operation is working on the same file.
                                sleepProcessCreate(curr_obj, key, value, seconds)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                //rejecting the promise due to error
                                reject(e);
                            }
                        });
                });
            }
        } catch (e) {
            return new Promise(function (resolve, reject) {
                //rejecting the promise due to error
                reject(e);
            });
        }
    }
    /**
     * This function is used by the user to read data.
     * @param {string} key - The key for which value must be fetched. Must be String.
     * @returns {Promise} - Returns a Promise which will resolve when the data has been fetched from the file.
     *
     * @example
     *
     *      let d1 = database.readData("someKey")
     *      d1.then(res => {
     *          //do something
     *      }).catch(err => {
     *          //do something
     *      });
     *
     * @example
     *
     *      async function func() {
     *          try {
     *              let d1 = await database.readData("someKey")
     *              //do somthing
     *          } catch(err) {
     *              //do something
     *          }
     *      }
     *
     */
    readData(key) {
        //Checking whether the given key is string or not
        if (typeof key !== "string") {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        try {
            //generating Hash for the key
            let key_hash = keyHash(key);
            //getting the fila data from LRU Cache if it exist otherwise storing undefined.
            let file_obj = cache.get(`${key_hash}.json`);
            //storing the file path
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            //Checking whether file/shard has been deleted or not.
            if (this.fileExist(`${key_hash}.json`) == false) {
                //returning appropriate promise
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            //if the value is not found in LRU cache, this block will execute.
            if (file_obj == undefined) {
                //storing this as this doesn't work inside promise.
                let curr_obj = this;
                return new Promise(function (resolve, reject) {
                    //locking the file so no other process can interrupt.
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            //Reading the file
                            fs.readFile(file_p, "utf-8", function (err, data) {
                                if (err) {
                                    reject(err);
                                } else {
                                    //parsing the read data into JSON
                                    file_obj = JSON.parse(data);
                                    //storing it in LRU cache
                                    cache.set(`${key_hash}.json`, file_obj);
                                    //checking whether the data have the given key
                                    if (file_obj.hasOwnProperty(key)) {
                                        //resolving with the data
                                        resolve({ status: "Success", data: file_obj[key] });
                                    } else {
                                        //rejecting with appropriate message
                                        reject({ status: "Error", msg: "Key doesn't exist" });
                                    }
                                }
                            });
                            //releasing the lock after work has been done.
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                //putting the process to sleep as some other process is working on the same file.
                                sleepProcessRead(curr_obj, key)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                //rejecting with error
                                reject(e);
                            }
                        });
                });
            } else {
                //if the data exist in LRU cache, then this block will execute
                return new Promise(function (resolve, reject) {
                    //checking whether given key exist or not.
                    if (file_obj.hasOwnProperty(key)) {
                        //resolving with the data
                        resolve({ status: "Success", data: file_obj[key] });
                    } else {
                        //rejecting with appropriate message
                        reject({ status: "Error", msg: "Key doesn't exist" });
                    }
                });
            }
        } catch (e) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    }
    /**
     * This function is used by the user to delete data.
     * @param {string} key - The key for which key & value must be deleted. Must be String.
     * @returns {Promise} - Returns a Promise which will resolve when the data has been deleted from the file.
     *
     * @example
     *
     *      let d1 = database.deleteData("someKey")
     *      d1.then(res => {
     *          //do something
     *      }).catch(err => {
     *          //do something
     *      });
     *
     * @example
     *
     *      async function func() {
     *          try {
     *              let d1 = await database.deleteData("someKey")
     *              //do somthing
     *          } catch(err) {
     *              //do something
     *          }
     *      }
     *
     */
    deleteData(key) {
        //Checking whether the given key is string or not
        if (typeof key !== "string") {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        try {
            //generating the hash for the key.
            let key_hash = keyHash(key);
            //storing the current object
            let curr_obj = this;
            //checking whether the data exist in LRU cache or not. Storing the data if it exist otherwise undefined.
            let file_obj = cache.get(`${key_hash}.json`);
            //storing the file path
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            //Checking whether file/shard has been deleted or not.
            if (this.fileExist(`${key_hash}.json`) == false) {
                //returning appropriate promise
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            //Thsi block will execute if teh data is not found in LRU cache.
            if (file_obj == undefined) {
                try {
                    let release = lockfile.lockSync(file_p);
                    file_obj = JSON.parse(fs.readFileSync(file_p, "utf-8"));
                    release();
                } catch (e) {
                    if (e.code == "ELOCKED") {
                        //putting the process to sleep as some other process is using the file.
                        sleepProcessDelete(curr_obj, key);
                    } else {
                        //putting the process to sleep as some other process is using the same file.
                        sleepProcessDelete(curr_obj, key)
                            .then(res => resolve(res))
                            .catch(err => reject(err));
                    }
                }
            }
            //Checking whether the key exist or not.
            if (file_obj.hasOwnProperty(key)) {
                return new Promise(function (resolve, reject) {
                    //locking the file for write operation.
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            // updating the size variable.
                            size -= Buffer.byteLength(JSON.stringify(file_obj[key])) + Buffer.byteLength(key);
                            //deleting the object
                            delete file_obj[key];
                            //updating the LRU cache
                            cache.set(`${key_hash}.json`, file_obj);
                            //writing on the file
                            fs.writeFile(file_p, JSON.stringify(file_obj), "utf8", err => {
                                if (err) {
                                    //rejecting with error
                                    reject(err);
                                } else {
                                    //resolving with appropriate message
                                    resolve({ status: "Sucess", msg: "File is Successfully Deleted." });
                                }
                            });
                            //releasing the lock on the file
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                //putting the process to sleep as some other process is using the same file.
                                sleepProcessDelete(curr_obj, key)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                //rejecting with error
                                reject(e);
                            }
                        });
                });
            } else {
                //returning appropriate promise
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "Key doesn't exist" });
                });
            }
        } catch (e) {
            //returning appropriate promise
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    }
}

module.exports = Database;
