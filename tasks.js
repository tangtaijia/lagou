var fs = require('fs');
var sleep = require('system-sleep');
var async = require('async');
var range = require('range').range;
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var redis = require('redis');
var common_client = null;
var assert = require('assert');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var exec = require('child_process').exec;
var companyfetcher = require('./companyfetcher');
var proxyfetcher = require('./proxyfetcher');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var yargs = require('yargs').argv;
var max_threads = yargs.t || 3;
var sleep_secs = yargs.s || 1;
var is_continue = yargs.c || false;
var with_job = yargs.j || false;
var oldTask = yargs.o || false;
var company_id_range = getCompanyIdRange(yargs.r);
var taskId = crypto.createHash('md5').update(new Date().toISOString()).digest("hex");
if(oldTask) {
    common_client = redis.createClient(config.common_redis);
    common_client.on("error", function (err) {
        console.log("remote redis Error " + err);
    });
}

if (is_continue) {
    MongoClient.connect(config.mongo_url, function (err, db) {
        assert.equal(null, err);
        checkLastCompanyId(db, function (start) {
            runTasks(start);
        });
    });
} else if(oldTask) {
    runOldTasks();
} else
    runTasks(company_id_range[0]);

var checkLastCompanyId = function (db, callback) {
    var cursor = db.collection('company').find(
        {
            $and: [
                {"companyId": {$gte: company_id_range[0]}},
                {"companyId": {$lte: company_id_range[1]}}
            ]
        }
    ).sort({update_time: -1}).limit(1);
    cursor.toArray(function (err, items) {
        assert.equal(null, err);
        if (items.length) {
            callback(items[0].companyId);
        } else {
            callback(company_id_range[0]);
        }
    });
};

function runOldTasks(start) {
    if(start)
        util.log('old task: ' + taskId + ' is running');
    common_client.lpop('stored_company_ids', function(err, companyId) {
        if(companyId >0 ) {
            companyfetcher(companyId, with_job, function (result) {
                util.log(result);
                if (sleep_secs) {
                    // 2000 以内的随机数
                    var delay = parseInt((Math.random() * 10000000) % 2000, 10);
                    if (companyId % 100 == 0)
                        delay = 15;
                    sleep(delay * sleep_secs);
                }
            });
            runOldTasks(false);
        } else {
            var dir = "/tmp/lagou/";
            mkdirp(dir, function (err) {
                assert.equal(null, err);
                util.log("old task: " + taskId + " results file was saved! all done!!!");
                exec('sudo pkill -f lagou/tasks.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    if (stderr && stderr.indexOf('proxychains') == -1) {
                        console.error(`exec stderror: ${stderr}`);
                        return;
                    }

                    console.info('kill all node process!!!');
                    process.exit(0);
                });
            });
        }
    });
}

function runTasks(start) {
    yargs.time = new Date();
    util.log('task: ' + taskId + ' is running');
    async.mapLimit(range(start, company_id_range[1]), max_threads, function (companyId, callback) {
        companyfetcher(companyId, with_job, function (result) {
            util.log(result);
            callback(null, result);
            if (sleep_secs) {
                // 2000 以内的随机数
                var delay = parseInt((Math.random() * 10000000) % 2000, 10);
                if (companyId % 100 == 0)
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
                exec('sudo pkill -f lagou/tasks.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    if (stderr && stderr.indexOf('proxychains') == -1) {
                        console.error(`exec stderror: ${stderr}`);
                        return;
                    }

                    console.info('kill all node process!!!');
                    process.exit(0);
                });
            });
        });
    });
}

function getCompanyIdRange(range_str) {
    if (!range_str || util.isNumber(range_str))
        company_id_range = [parseInt(range_str || 1), 100000];
    else
        company_id_range = yargs.r.split(',').map(Number);
    return [Math.min.apply(null, company_id_range), Math.max.apply(null, company_id_range)];
}
