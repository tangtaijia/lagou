var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var async = require('async');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var proxyips = require('./readfiledata')('proxyips.json');

exports = module.exports = function (pcallback) {
    async.series([
            function (callback) {
                console.info('run 1');
                // do some stuff ...
                callback(1, 'one');
            },
            function (callback) {
                console.info('run 2');
                // do some more stuff ...
                callback(null, 'two');
            }
        ],
        function (err, results) {
            console.info(err, results);
            // results is now equal to ['one', 'two']
        });
};