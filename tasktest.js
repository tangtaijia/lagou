var fs = require('fs');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var async = require('async');
var range = require('range').range;
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var redis = require('redis');
var common_client = redis.createClient(config.common_redis);
var yargs = require('yargs').argv;
var key_range = getKeyRange(yargs.r);
var current_key = 'current_company_key_' + key_range[0] + '_' + key_range[1];
var limit = 100;

common_client.on("error", function (err) {
    console.log("remote redis Error " + err);
});

MongoClient.connect(config.mongo_url, function (err, db) {
    assert.equal(null, err);

    // common_client.del('stored_company_keys', function (err, reply) {
    //     storeKeys(db, key_range[0], function (result) {
    //        console.log('store all keys');
    //         process.exit();
    //     });
    // });

    common_client.del('stored_company_keys', function (err, reply) {
        async.mapLimit(range(0, 9), 10, function (key, callback) {
            storeKeys(db, key * 10000, (key + 1) * 10000, function (result) {
                callback(null, result);
            });
        }, function (err, result) {
            db.close();
            util.log('all done', result);
            process.exit();
        });
    });

    // common_client.lpop('stored_company_keys', function(err, reply) {
    //     console.log(reply); // ['angularjs', 'backbone']
    // });
});

common_client.get(current_key, function (err, reply) {
    util.log(err, reply);
    if (!reply) {
        util.log(config.mongo_url);
        MongoClient.connect(config.mongo_url, function (err, db) {
            assert.equal(null, err);
            checkLastKey(db, function (start) {
                util.log('run task:' + start);
                common_client.set(current_key, ++start, function (err, reply) {
                    util.log(reply);
                });
            });
        });
    } else {
        util.log(current_key, reply);
        util.log('run task:' + reply);
        common_client.set(current_key, ++reply, function (err, reply) {
            util.log(reply);
        });
    }
});

var storeKeys = function (db, start, end, callback) {
    getStoredKeys(db, start, function (keys) {
        util.log(keys, start, start + limit);
        common_client.rpush(['stored_company_keys'].concat(keys), function (err, reply) {
            util.log(reply);
            if (start <= end) {
                start += limit;
                storeKeys(db, start, end, callback);
            } else
                callback(reply);
        });
    });
};

var getStoredKeys = function (db, start, callback) {
    var cursor = db.collection('company').find(
        {
            $and: [
                {"key": {$gte: start}},
                {"key": {$lte: limit + start}}
            ]
        },
        {
            'key': true,
            '_id': false
        }
    ).sort({key: 1});
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        callback(items.map(function (item) {
            return item.key;
        }));
    });

};

var checkLastKey = function (db, callback) {
    var cursor = db.collection('company').find(
        {
            $and: [
                {"key": {$gte: key_range[0]}},
                {"key": {$lte: key_range[1]}}
            ]
        }
    ).sort({update_time: -1}).limit(1);
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        if (items.length) {
            callback(items[0].key);
        } else {
            callback(key_range[0]);
        }
    });
};

function getKeyRange(range_str) {
    if (!range_str || util.isNumber(range_str))
        key_range = [parseInt(range_str || 1), 100000];
    else
        key_range = yargs.r.split(',').map(Number);
    return [Math.min.apply(null, key_range), Math.max.apply(null, key_range)];
}