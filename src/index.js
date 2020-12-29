const fs = require("fs");
const path = require("path");

class Database {
    constructor(name, filePath = __dirname) {
        this.name = name;
        try {
            if (fs.lstatSync(filePath).isDirectory() == true) this.filePath = filePath;
            else {
                console.error("Path is not a Directory");
                console.error("Using Default path to save data");
                this.filePath = __dirname;
            }
        } catch (e) {
            if (e.code == "ENOENT") {
                console.error("No file or Directory Exist: " + filePath);
                console.error("Using Default path to save data");
                this.filePath = __dirname;
            } else throw e;
        }
        try {
            fs.mkdirSync(path.join(this.filePath, "data"));
        } catch (e) {
            if (e.code == "EEXIST") console.log("Directory already exist! Data will be saved there.");
            else throw e;
        }
    }
    printName() {
        console.log(this.name);
        console.log(this.filePath);
    }
}

module.exports = Database;
