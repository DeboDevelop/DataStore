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
 * @type {Number}
 */
let size = 0;

/**
 * This function is used to achieve TTL on a certain key.
 * This function should not be directly called and should only be used through createData method of Database class.
 * @param {Object} database - The Database object for which this function is called.
 * @param {string} filename - The file(shard) in which the data is stored
 * @param {string} key - The key of the data which will be deleted.
 * @param {Number} seconds - The no. of seconds after which it will be deleted.
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
 * @returns {Boolean} - return whether the file exist or not.
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
 * @returns {Number} - It returns a no. between 0 to 9 depending on the key.
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
 * @param {Number} seconds - if TTL is enabled for the data then it contains the no. of seconds otherwise undefined.
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
            if (fs.lstatSync(file_path).isDirectory() == true) this.file_path = file_path;
            else {
                console.error("Path is not a Directory");
                console.error("Using Default path to save data");
                this.file_path = __dirname;
            }
        } catch (e) {
            if (e.code == "ENOENT") {
                console.error("No file or Directory Exist: " + file_path);
                console.error("Using Default path to save data");
                this.file_path = __dirname;
            } else throw e;
        }
        try {
            fs.mkdirSync(path.join(this.file_path, "data"));
        } catch (e) {
            if (e.code == "EEXIST") console.log("Directory already exist! Data will be saved there.");
            else throw e;
        }
        try {
            for (let i = 0; i < 10; i++) {
                let file_p = path.join(this.file_path, "data", `${i}.json`);
                let value = fs.readFileSync(file_p, "utf8");
                size += Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(`${i}.json`);
            }
        } catch (e) {
            if (e.code == "ENOENT") {
                for (let i = 0; i < 10; i++) {
                    let file_p = path.join(this.file_path, "data", `${i}.json`);
                    fs.writeFileSync(file_p, "{}", "utf8");
                    size += Buffer.byteLength("{}") + Buffer.byteLength(`${i}.json`);
                }
            } else throw e;
        }
        try {
            fs.mkdirSync(path.join(this.file_path, "config"));
        } catch (e) {
            if (e.code == "EEXIST") console.log("Config Directory Exist");
            else throw e;
        }
        createConfigFile(this);
    }
    fileExist(file_name) {
        let file_p = path.join(this.file_path, "data", file_name);
        try {
            if (fs.lstatSync(file_p).isFile()) return true;
            else return false;
        } catch (e) {
            //console.log(e);
            return false;
        }
    }
    createData(key, value, seconds = undefined) {
        if (size >= 1024 * 1024 * 1024) {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Size of Database is more than 1 GB, please delete some files." });
            });
        }
        if (typeof key !== "string") {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        if (value === null) {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value is Null" });
            });
        }
        if (typeof value !== "object") {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value have to be JSON" });
            });
        }
        if (key.length > 32) {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key is more than 32 characters." });
            });
        }
        if (Buffer.byteLength(JSON.stringify(value)) > 16 * 1024) {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Value is more than 16 KB." });
            });
        }
        try {
            let key_hash = keyHash(key);
            //console.log(this.name + " : " + key_hash);
            let file_obj = cache.get(`${key_hash}.json`);
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            if (this.fileExist(`${key_hash}.json`) == false) {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            if (file_obj == undefined) {
                file_obj = JSON.parse(fs.readFileSync(file_p, "utf8"));
                cache.set(`${key_hash}.json`, file_obj);
            }
            if (file_obj.hasOwnProperty(key)) {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "Key already exist." });
                });
            } else {
                file_obj[key] = value;
                size += Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(key);
                cache.set(`${key_hash}.json`, file_obj);
                let curr_obj = this;
                return new Promise(function (resolve, reject) {
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            fs.writeFile(file_p, JSON.stringify(file_obj), "utf8", err => {
                                if (err) reject(err);
                                else {
                                    if (seconds !== undefined) {
                                        deleteFileAfterSomeTime(curr_obj, key_hash, key, seconds);
                                    }
                                    resolve({ status: "Sucess", msg: "File is Created Successfully." });
                                }
                            });
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                sleepProcessCreate(curr_obj, key, value, seconds)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                reject(e);
                            }
                        });
                });
            }
        } catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    }
    readData(key) {
        if (typeof key !== "string") {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        try {
            let key_hash = keyHash(key);
            let file_obj = cache.get(`${key_hash}.json`);
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            if (this.fileExist(`${key_hash}.json`) == false) {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            if (file_obj == undefined) {
                let curr_obj = this;
                return new Promise(function (resolve, reject) {
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            fs.readFile(file_p, "utf-8", function (err, data) {
                                if (err) {
                                    reject(err);
                                } else {
                                    file_obj = JSON.parse(data);
                                    cache.set(`${key_hash}.json`, file_obj);
                                    if (file_obj.hasOwnProperty(key)) {
                                        resolve({ status: "Success", data: file_obj[key] });
                                    } else {
                                        reject({ status: "Error", msg: "Key doesn't exist" });
                                    }
                                }
                            });
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                sleepProcessRead(curr_obj, key)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                reject(e);
                            }
                        });
                });
            } else {
                return new Promise(function (resolve, reject) {
                    if (file_obj.hasOwnProperty(key)) {
                        resolve({ status: "Success", data: file_obj[key] });
                    } else {
                        reject({ status: "Error", msg: "Key doesn't exist" });
                    }
                });
            }
        } catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    }
    deleteData(key) {
        if (typeof key !== "string") {
            return new Promise(function (resolve, reject) {
                reject({ status: "Error", msg: "Key have to be String" });
            });
        }
        try {
            let key_hash = keyHash(key);
            let curr_obj = this;
            let file_obj = cache.get(`${key_hash}.json`);
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
            if (this.fileExist(`${key_hash}.json`) == false) {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "File not Found. Somebody tempared with the file" });
                });
            }
            if (file_obj == undefined) {
                lockfile
                    .lock(file_p)
                    .then(release => {
                        file_obj = fs.readFileSync(file_p, "utf-8");
                        return release();
                    })
                    .catch(e => {
                        if (e.code == "ELOCKED") {
                            sleepProcessDelete(curr_obj, key);
                        } else {
                            console.log(e);
                        }
                    });
            }
            if (file_obj.hasOwnProperty(key)) {
                return new Promise(function (resolve, reject) {
                    lockfile
                        .lock(file_p)
                        .then(release => {
                            size -= Buffer.byteLength(JSON.stringify(file_obj[key])) + Buffer.byteLength(key);
                            delete file_obj[key];
                            cache.set(`${key_hash}.json`, file_obj);
                            fs.writeFile(file_p, JSON.stringify(file_obj), "utf8", err => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ status: "Sucess", msg: "File is Successfully Deleted." });
                                }
                            });
                            return release();
                        })
                        .catch(e => {
                            if (e.code == "ELOCKED") {
                                sleepProcessDelete(curr_obj, key)
                                    .then(res => resolve(res))
                                    .catch(err => reject(err));
                            } else {
                                reject(e);
                            }
                        });
                });
            } else {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "Key doesn't exist" });
                });
            }
        } catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    }
}

module.exports = Database;
