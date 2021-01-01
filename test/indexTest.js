const assert = require("chai").assert;
const Database = require("../src/index");
var rimraf = require("rimraf");
const path = require("path");

let database1;

let key1 = "123456";

let key2 = "654321";

let value1 = {
    read: "Write",
    Music: "Melody",
    Hello: "World",
    test: "Toast",
};

describe("Testing Database", function () {
    after(function () {
        console.log("Wait for the Clean up");
        setTimeout(() => {
            console.log("Cleaned up");
            let data_file_path = path.join(database1.file_path, "data");
            let config_file_path = path.join(database1.file_path, "config");
            rimraf.sync(data_file_path);
            rimraf.sync(config_file_path);
        }, 5 * 1000);
    });

    describe("Test1", function () {
        it("creation of Database", async function () {
            const database_name = "Database";
            database1 = new Database(database_name);
            assert.equal(database1.name, database_name);
        });
    });

    describe("Test2", function () {
        it("createData should fail because key is not string", async function () {
            let result;
            try {
                result = await database1.createData(123, value1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key have to be String");
        });
    });

    describe("Test3", function () {
        it("createData should fail because value is null", async function () {
            let result;
            try {
                result = await database1.createData(key1, null);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Value is Null");
        });
    });

    describe("Test4", function () {
        it("createData should fail because value is not object", async function () {
            let result;
            try {
                result = await database1.createData(key1, "null");
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Value have to be JSON");
        });
    });

    describe("Test5", function () {
        it("createData should fail because key is too large", async function () {
            let result;
            try {
                result = await database1.createData("123123123123123123123123123123123123", value1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key is more than 32 characters.");
        });
    });

    describe("Test6", function () {
        it("createData should succeed", async function () {
            let result;
            try {
                result = await database1.createData(key1, value1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "File is Created Successfully.");
        });
    });

    describe("Test7", function () {
        it("createData should fail because key already exist", async function () {
            let result;
            try {
                result = await database1.createData(key1, value1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key already exist.");
        });
    });

    describe("Test8", function () {
        it("createData should succeed", async function () {
            let result;
            try {
                result = await database1.createData(key2, value1, 1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "File is Created Successfully.");
        });
        setTimeout(() => {
            it("createData should succeed", async function () {
                let result;
                try {
                    result = await database1.createData(key2, value1);
                } catch (err) {
                    result = err;
                }
                assert.equal(result.msg, "File is Created Successfully.");
            });
        }, 2 * 1000);
    });

    describe("Test9", function () {
        it("readData should fail because key is not string", async function () {
            let result;
            try {
                result = await database1.readData(123456);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key have to be String");
        });
    });

    describe("Test10", function () {
        it("readData should fail because key doesn't exist", async function () {
            let result;
            try {
                result = await database1.readData("abcdef");
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key doesn't exist");
        });
    });

    describe("Test11", function () {
        it("readData should succeed", async function () {
            let result;
            try {
                result = await database1.readData(key1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.status, "Success");
        });
    });

    describe("Test12", function () {
        it("deleteData should fail because key is not string", async function () {
            let result;
            try {
                result = await database1.deleteData(123456);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key have to be String");
        });
    });

    describe("Test13", function () {
        it("deleteData should succeed", async function () {
            let result;
            try {
                result = await database1.deleteData(key1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "File is Successfully Deleted.");
        });
    });

    describe("Test14", function () {
        it("deleteData should fail because key doesn't exist", async function () {
            let result;
            try {
                result = await database1.deleteData(key1);
            } catch (err) {
                result = err;
            }
            assert.equal(result.msg, "Key doesn't exist");
        });
    });
});
