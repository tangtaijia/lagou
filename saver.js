var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = function (data, type, callback) {
    MongoClient.connect(config.mongo_url, function (err, db) {
        checkDocument(db, data, type,
            function () {
                insertDocument(db, data, type, function () {
                    db.close();
                    if(callback)
                        callback('insert');
                })
            }
            , function () {
                updateDocument(db, data, type, function () {
                    db.close();
                    if(callback)
                        callback('update');
                })
            }
        );
    });
};

var insertDocument = function (db, data, type, callback) {
    data.create_time = new Date();
    data.update_time = new Date();
    db.collection(type).insertOne(data, function (err, result) {
        assert.equal(err, null);
        callback();
    });
};

var updateDocument = function (db, data, type, callback) {
    db.collection(type).updateOne(
        {"name": data.name},
        {
            $set: data,
            $currentDate: { "update_time": true }
        },
        function (err, result) {
            assert.equal(err, null);
            callback();
        });
};

var checkDocument = function (db, data, type, insertCallback, updateCallback) {
    var cursor = db.collection(type).find({"name": data.name}).limit(1);
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        if (items.length) {
            updateCallback(db, data, type);
        } else {
            insertCallback(db, data, type);
        }
    });
};