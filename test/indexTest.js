const assert = require("chai").assert;
const Database = require("../src/index");
var rimraf = require("rimraf");
const path = require("path");

let database1;

let key1 = "123456";

let value1 = {
    read: "Write",
    Music: "Melody",
    Hello: "World",
    test: "Toast",
};

describe("Testing Database", function () {
    describe("Test1", function () {
        it("creation of Database", async function () {
            database1 = new Database("Database");
            assert.equal(database1.name, "Database");
        });
    });

    describe("Test2", function () {
        it("createData should fail", async function () {
            let result;
            try {
                result = await database1.createData(123, value1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.status, "Error");
        });
    });

    describe("Test3", function () {
        it("Cleanup", function () {
            let data_file_path = path.join(database1.file_path, "data");
            let config_file_path = path.join(database1.file_path, "config");
            rimraf.sync(data_file_path);
            rimraf.sync(config_file_path);
        });
    });
});
