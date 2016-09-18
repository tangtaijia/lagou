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
var limit = 100;

common_client.on("error", function (err) {
    console.log("remote redis Error " + err);
});

MongoClient.connect(config.mongo_url, function (err, db) {
    assert.equal(null, err);

    common_client.del('stored_company_ids', function (err, reply) {
        async.mapLimit(range(0, 9), 10, function (companyId, callback) {
            storeCompanyIds(db, companyId * 10000, (companyId + 1) * 10000, function (result) {
                callback(null, result);
            });
        }, function (err, result) {
            db.close();
            util.log('all done');
            process.exit();
        });
    });

});

var storeCompanyIds = function (db, start, end, callback) {
    getStoredCompanyIds(db, start, function (companyIds) {
        common_client.rpush(['stored_company_ids'].concat(companyIds), function (err, reply) {
            start += limit;
            if (start < end) {
                start += parseInt((start % 100) == 0 ? 1 : 0);
                util.log((end - start) / 100 + "%", reply ? reply : '  ', companyIds.length ? companyIds.length : '');
                storeCompanyIds(db, start, end, callback);
            } else
                callback(reply);
        });
    });
};

var getStoredCompanyIds = function (db, start, callback) {
    var cursor = db.collection('company').find(
        {
            $and: [
                {"companyId": {$gte: start}},
                {"companyId": {$lte: limit + start}}
            ]
        },
        {
            'companyId': true,
            '_id': false
        }
    ).sort({companyId: 1});
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        callback(items.map(function (item) {
            return item.companyId;
        }));
    });

};