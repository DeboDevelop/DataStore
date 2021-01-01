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

let config_data = [];
let size = 0;

function deleteFileAfterSomeTime(database, filename, key, seconds) {
    let curr_time = new Date().getTime();
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    let config_obj = {
        database_name: database.name,
        file_name: filename,
        key: key,
        exp_time: curr_time + seconds * 1000,
    };
    config_data.push(config_obj);
    try {
        fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
    } catch (e) {
        throw e;
    }
    setTimeout(() => {
        let x = database.deleteData(key);
        x.then(res => console.log(res)).catch(err => console.log(err));
        let newArr = config_data.filter(item => item.key != config_obj.key);
        try {
            fs.writeFileSync(file_p, JSON.stringify(newArr), "utf8");
        } catch (e) {
            throw e;
        }
    }, seconds * 1000);
}

function checkConfigFile(file_p) {
    try {
        if (fs.lstatSync(file_p).isFile()) return true;
        else return false;
    } catch (e) {
        //console.log(e);
        return false;
    }
}

function createConfigFile(database) {
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    try {
        if (checkConfigFile(file_p)) {
            console.log("Config File Exist! Backing the data");
            config_data = JSON.parse(fs.readFileSync(file_p, "utf8"));
            deleteOutdatedFile(database);
        } else {
            fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
        }
    } catch (e) {
        throw e;
    }
}

function deleteOutdatedFile(database) {
    console.log("Deleting Outdated Data");
    let file_p = path.join(database.file_path, "config", `${database.name}.json`);
    try {
        let curr_time = new Date().getTime();
        let newArr = [];
        for (let i = 0; i < config_data.length; i++) {
            if (config_data[i].exp_time < curr_time) {
                let x = database.deleteData(config_data[i].key);
                x.then(res => console.log(res)).catch(err => console.log(err));
            } else {
                newArr.push(config_data[i]);
            }
        }
        config_data = newArr;
        fs.writeFileSync(file_p, JSON.stringify(config_data), "utf8");
    } catch (e) {
        throw e;
    }
}

function keyHash(key) {
    let num = 0;
    for (let i = 0; i < key.length; i += 2) {
        num += key.charCodeAt(i);
    }
    return num % 10;
}

function sleepProcessCreate(obj, key, value, seconds) {
    console.log(
        "Create data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    if (seconds == undefined) {
        return new Promise(function (resolve, reject) {
            setTimeout(() => {
                obj.createData(key, value)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }, 5 * 1000);
        });
    } else {
        return new Promise(function (resolve, reject) {
            setTimeout(() => {
                obj.createData(key, value, seconds)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }, 5 * 1000);
        });
    }
}

function sleepProcessRead(obj, key) {
    console.log(
        "Read data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    return new Promise(function (resolve, reject) {
        setTimeout(() => {
            obj.readData(key)
                .then(res => resolve(res))
                .catch(err => reject(err));
        }, 5 * 1000);
    });
}

function sleepProcessDelete(obj, key) {
    console.log(
        "Delete data process for key : " + key + " is put to sleep, promise will resolve when the process execute"
    );
    return new Promise(function (resolve, reject) {
        setTimeout(() => {
            obj.deleteData(key)
                .then(res => resolve(res))
                .catch(err => reject(err));
        }, 5 * 1000);
    });
}

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
        if (typeof value === null) {
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
            console.log(this.name + " : " + key_hash);
            let file_obj = cache.get(`${key_hash}.json`);
            let file_p = path.join(this.file_path, "data", `${key_hash}.json`);
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
                                console.log(e);
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
                                console.log(e);
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
                                console.log(e);
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
