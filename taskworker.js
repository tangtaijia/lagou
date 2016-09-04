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
    // console.log('connected');
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
        if (!reply || reply < 1045) {
            proxyfetcher.runTask(function (proxyips) {
                console.info('new ips:', proxyips.length);
                addIps(proxyips,  function (err, reply) {
                    console.info('save ' + reply + ' new ips');
                    gen_ips();
                    sleep(1000);
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

var addIps = exports.addIps = function (ips, callback) {
    ips.forEach(function (value, index) {
        ips[index] = JSON.stringify(value);
    });
    client.sadd(['ips'].concat(ips), function (err, reply) {
        callback(err, reply);
    });
};

var getValidIp = exports.getValidIp = function (pass, callback) {
    if (!pass) {
        gen_valid(function (proxyip) {
            try {
                proxyip = JSON.parse(proxyip);
            } catch (e) {
                return getValidIp(pass, callback);
            }
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
                            getValidIp(pass, callback);
                        });
                    }
                } else {
                    console.error(new Date() + ' verify proxy ' + JSON.stringify(proxyip) + ', error:' + error);
                    addInvalid(JSON.stringify(proxyip), function (err, reply) {
                        getValidIp(pass, callback);
                    });
                }
            });
        });
    } else
        callback(false);
};
