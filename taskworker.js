var redis = require('redis');
var client = redis.createClient();
var fs = require('fs');
var sleep = require('system-sleep');
var request = require('request');
var cheerio = require('cheerio');
var proxyfetcher = require('./proxyfetcher');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

client.on("error", function (err) {
    console.log("Error " + err);
});

client.on('connect', function () {
    console.log('connected');
});

var gen_valid = function (callback) {
    client.sdiffstore('valid_ips', 'ips', 'invalid_ips', function (err, reply) {
        client.scard('invalid_ips', function (err, reply) {
            client.srandmember('ips', function (err, reply) {
                callback(reply);
            });
        });
    });
};

var gen_ips = exports.gen_ips = function () {
    client.scard('valid_ips', function (err, reply) {
        console.info('num of valid_ips:' + reply);
        // fetch new ips
        if (!reply || reply < 500) {
            proxyfetcher.runTask(function (proxyips) {
                console.info('new ips:', proxyips.length);
                proxyips.forEach(function (value, index) {
                    proxyips[index] = JSON.stringify(value);
                });
                client.sadd(['ips'].concat(proxyips), function (err, reply) {
                    gen_valid(function (proxyip) {
                        console.log(proxyip);
                        gen_ips();
                        sleep(1000);
                    });
                });
            });
        } else {
            gen_ips();
            sleep(1000);
        }
    });
};

var addInvalid = exports.addInvalid = function (ip, callback) {
    client.sadd('invalid_ips', ip, function (err, reply) {
        callback(err, reply);
    });
};

var getValidIp = exports.getValidIp = function (callback) {
    gen_valid(function (proxyip) {
        proxyip = JSON.parse(proxyip);
        var options = {
            url: 'http://do.tangtaijia.com/verify.html',
            proxy: 'http://' + proxyip.ip + ':' + proxyip.port,
            timeout: config.timeout
        };
        request(options, function (error, response, html) {
            if (!error) {
                if (html && html.trim() == 'success')
                    callback(proxyip);
                else {
                    var $ = cheerio.load(html);
                    console.error(new Date() + ' verify proxy ' + JSON.stringify(proxyip) + ', statuscode:' + response.statusCode + ', title:' + $('title').text());
                    addInvalid(JSON.stringify(proxyip), function (err, reply) {
                        getValidIp(callback);
                        sleep(100);
                    });
                }
            } else {
                console.error(new Date() + ' verify proxy ' + JSON.stringify(proxyip) + ', error:' + error);
                addInvalid(JSON.stringify(proxyip), function (err, reply) {
                    getValidIp(callback);
                });
            }
        });
    });
};
