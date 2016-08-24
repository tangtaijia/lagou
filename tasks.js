var sleep = require('system-sleep');
var async = require('async');
var range = require('range').range;
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var fetch = require('./fetch');
var max_threads = process.argv[2] || 3;
var sleep_secs = process.argv[3] || 1;
var contin = process.argv[4] || 1;

if(contin) {
    var url = 'mongodb://localhost:27017/lagou';
    MongoClient.connect(url, function (err, db) {
        checkLastKey(db, function (start) {
            runTasks(start);
        });
    });
} else
    runTasks(1);

var checkLastKey = function (db, callback) {
    var cursor = db.collection('company').find().sort({key: -1}).limit(1);
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        if (items.length) {
            callback(items[0].key);
        } else {
            callback(1);
        }
    });
};

function runTasks(start) {
    async.mapLimit(range(start, 100000), max_threads, function (key, callback) {
        fetch(key, function (result) {
            callback(null, result);
            util.log(result);
            // 2000 以内的随机数
            var delay = parseInt((Math.random() * 10000000) % 2000, 10);
            if (key % 100 == 0)
                delay = 15;
            sleep(delay * sleep_secs);
        });
    }, function (err, result) {
        fs.writeFile("/tmp/lagou/results", result, function (err) {
            if (err) {
                return console.error(err);
            }
            util.log("The results file was saved! all done!!!");
        });
    });
}
