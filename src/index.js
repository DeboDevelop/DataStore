const fs = require("fs");
const path = require("path");

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
    createData(key, value) {
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
            if (this.fileExist(`${key}.json`)) {
                return new Promise(function (resolve, reject) {
                    reject({ status: "Error", msg: "Key already exist." });
                });
            } else {
                let file_p = path.join(this.file_path, "data", `${key}.json`);
                return new Promise(function (resolve, reject) {
                    fs.writeFile(file_p, JSON.stringify(value), "utf8", err => {
                        if (err) reject(err);
                        else {
                            resolve({ status: "Sucess", msg: "File is Created Successfully." });
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
        try {
            if (this.fileExist(`${key}.json`)) {
                const file_p = path.join(this.file_path, "data", `${key}.json`);
                return new Promise(function (resolve, reject) {
                    fs.readFile(file_p, "utf8", (err, data) => {
                        if (err) reject(err);
                        else {
                            resolve(data);
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
    deleteData(key) {
        try {
            if (this.fileExist(`${key}.json`)) {
                const file_p = path.join(this.file_path, "data", `${key}.json`);
                return new Promise(function (resolve, reject) {
                    fs.unlink(file_p, err => {
                        if (err) reject(err);
                        else {
                            resolve({ status: "Sucess", msg: "File is Successfully Deleted." });
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
    printName() {
        console.log(this.name);
        console.log(this.file_path);
    }
}

module.exports = Database;
