var sleep = require('system-sleep');
var async = require('async');
var range = require('range').range;
var util = require('util');
var fetch = require('./fetch');
var max_threads = process.argv[2] || 3;
var sleep_secs = process.argv[3] || 1;

async.mapLimit(range(1, 100000), max_threads, function (key, callback) {
    fetch(key, function (result) {
        callback(null, result);
        util.log(result);
        // 2000 以内的随机数
        var delay = parseInt((Math.random() * 10000000) % 2000, 10);
        console.info(delay);
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
