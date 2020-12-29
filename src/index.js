const fs = require("fs");

class Database {
    constructor(name, filePath = __dirname) {
        this.name = name;
        try {
            fs.lstatSync(filePath).isDirectory();
            this.filePath = filePath;
        } catch (e) {
            if (e.code == "ENOENT") {
                console.log("No file or Directory Exist: " + filePath);
                console.log("Using Default path to save data");
                this.filePath = __dirname;
            } else {
                throw e;
            }
        }
    }
    printName() {
        console.log(this.name);
        console.log(this.filePath);
    }
}

module.exports = Database;
