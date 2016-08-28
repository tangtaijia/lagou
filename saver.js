var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var util = require('util');
var sleep = require('system-sleep');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var proxyips = require('./readfiledata')('proxyips.json');
var retry_count = 0;

var self = module.exports = function (data, type, callback) {
    MongoClient.connect(config.mongo_url, function (err, db) {
        if (!db) {
            self(data, type, callback);
        } else {
            checkDocument(db, data, type, function () {
                    self(data, type, callback);
                },
                function () {
                    insertDocument(db, data, type, function () {
                        self(data, type, callback);
                    }, function () {
                        db.close();
                        if (callback)
                            callback('insert');
                    })
                }
                , function () {
                    updateDocument(db, data, type, function () {
                        self(data, type, callback);
                    }, function () {
                        db.close();
                        if (callback)
                            callback('update');
                    })
                }
            );
        }
    });
};

var insertDocument = function (db, data, type, pcallback, callback) {
    data.create_time = new Date();
    data.update_time = new Date();
    db.collection(type).insertOne(data, function (err, result) {
        if (err) {
            if (++retry_count > 3) {
                assert.equal(null, err);
            } else {
                util.log('insert Document error: ' + updateDocument() + ', key:' + key);
                sleep(1000);
                pcallback();
            }

        } else
            callback();
    });
};

var updateDocument = function (db, data, type, pcallback, callback) {
    db.collection(type).updateOne(
        {"name": data.name},
        {
            $set: data,
            $currentDate: {"update_time": true}
        },
        function (err, result) {
            if (err) {
                if (++retry_count > 3) {
                    assert.equal(null, err);
                } else {
                    util.log('update Document error: ' + updateDocument() + ', key:' + key);
                    sleep(1000);
                    pcallback();
                }

            } else
                callback();
        });
};

var checkDocument = function (db, data, type, pcallback, insertCallback, updateCallback) {
    var cursor = db.collection(type).find({"name": data.name}).limit(1);
    cursor.toArray(function (err, items) {
        if (err) {
            if (++retry_count > 3) {
                assert.equal(null, err);
            } else {
                util.log('check Document error: ' + updateDocument() + ', key:' + key);
                sleep(1000);
                pcallback();
            }

        } else {
            if (items.length) {
                updateCallback(db, data, type);
            } else {
                insertCallback(db, data, type);
            }
        }

    });
};