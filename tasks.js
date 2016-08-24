var fs = require('fs');
var sleep = require('system-sleep');
var async = require('async');
var range = require('range').range;
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var fetch = require('./fetch');
var yargs = require('yargs').argv;
var max_threads = yargs.t || 3;
var sleep_secs = yargs.s || 1;
var is_continue = yargs.c || false;
var key_range = getKeyRange(yargs.r);
var taskId = crypto.createHash('md5').update(new Date().toISOString()).digest("hex");

if (is_continue) {
    var url = 'mongodb://localhost:27017/lagou';
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        checkLastKey(db, function (start) {
            runTasks(start);
        });
    });
} else
    runTasks(key_range[0]);

var checkLastKey = function (db, callback) {
    var cursor = db.collection('company').find(
        {
            $and: [
                {"key": {$gte: key_range[0]}},
                {"key": {$lte: key_range[1]}}
            ]
        }
    ).sort({key: -1}).limit(1);
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        if (items.length) {
            callback(items[0].key);
        } else {
            callback(key_range[0]);
        }
    });
};

function runTasks(start) {
    yargs.time = new Date();
    util.log('task: ' + taskId + ' is running');
    async.mapLimit(range(start, key_range[1]), max_threads, function (key, callback) {
        fetch(key, function (result) {
            callback(null, result);
            util.log(result);
            if(sleep_secs) {
                // 2000 以内的随机数
                var delay = parseInt((Math.random() * 10000000) % 2000, 10);
                if (key % 100 == 0)
                    delay = 15;
                sleep(delay * sleep_secs);    
            }
        });
    }, function (err, result) {
        var dir = "/tmp/lagou/";
        mkdirp(dir, function (err) {
            assert.equal(null, err);
            fs.writeFile(dir + "results-" + taskId, result, function (err) {
                if (err) {
                    return console.error(err);
                }
                util.log("task: " + taskId + " results file was saved! all done!!!");
                process.exit(0);
            });
        });
    });
}

function getKeyRange(range_str) {
    if (!range_str || util.isNumber(range_str))
        key_range = [parseInt(range_str || 1), 100000];
    else
        key_range = yargs.r.split(',').map(Number);
    return [Math.min.apply(null, key_range), Math.max.apply(null, key_range)];
}
