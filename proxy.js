var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var self = module.exports = function (callback) {
    if(config.records) {
        var random_index = Math.floor(Math.random() * (config.records.length - 1)) + 1;
        verify(config.records, random_index, function (record) {
            callback('http://' + record.ip + ':' + record.port);
        });
    } else {
        var options = {
            url: 'http://cn-proxy.com/',
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            maxRedirects: 10
        };
        process.setMaxListeners(0);
        request(options, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html);
                var records = [];
                $('table tbody tr').each(function (index, element) {
                    records.push({'ip': $(element).find('td').first().text(), 'port': $(element).find('td').eq(1).text()});
                });
                config.records = records;
                fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
                var random_index = Math.floor(Math.random() * (config.records.length - 1)) + 1;
                verify(config.records, random_index, function (record) {
                    callback('http://' + record.ip + ':' + record.port);
                });
            } else {
                console.error(error);
            }
        });
    }
    
};

var verify = exports.verify = function(records, index, callback) {
    index = index >= records.length ? 0 : index;
    var record = records[index];
    var options = {
        url: 'http://do.tangtaijia.com/',
        proxy: 'http://' + record.ip + ':' + record.port
    };
    request(options, function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);
            if($('title').html() && $('title').html().indexOf('Nginx') > -1)
                callback(record);
            else
                verify(records, ++index, callback);
        } else {
            console.error(error);
            verify(records, ++index, callback);
        }
    });
};