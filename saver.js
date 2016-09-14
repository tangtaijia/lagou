var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var util = require('util');
var sleep = require('system-sleep');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var retry_count = 0;

var self = module.exports = function (data, type, callback) {
    MongoClient.connect(config.mongo_url, function (err, db) {
        if (!db) {
            self(data, type, callback);
        } else {
            insertDocument(db, data, type, function () {
                self(data, type, callback);
            }, function () {
                db.close();
                if (callback)
                    callback('save');
            });
        }
    });
};

var insertDocument = function (db, data, type, pcallback, callback) {
    if(!db) {
        if (++retry_count > 15) {
            assert.notEqual(undefined, db);
        } else {
            util.log('insert Document error: db undefined, key:' + data.key);
            sleep(1000);
            pcallback();
        }
    }
    // upsert要配合下unique index: db.collection.ensureIndex( { "keyname": 1 }, { unique: true } )
    db.collection(type).updateOne(
        type == 'company' ? {"key": data.key} : {"positionId": data.positionId},
        {$set:data,$currentDate: {"update_time": true}},
        { upsert: true},
        function (err, result) {
            if (err) {
                if (++retry_count > 15) {
                    assert.equal(null, err);
                } else {
                    util.log('insert Document error: ' + err + ', key:' + data.key);
                    sleep(1000);
                    pcallback();
                }

            } else
                callback();
        }
    );
    
};