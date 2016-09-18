var fs = require('fs');
var sleep = require('system-sleep');
var request = require('request');
var cheerio = require('cheerio');
var util = require('util');
var proxyfetcher = require('./proxyfetcher');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var redis = require('redis');
var local_client = redis.createClient();
var common_client = redis.createClient(config.common_redis);
var yargs = require('yargs').argv;
var filter = yargs.f || false;
var white = yargs.w || false;
var filter_timeout = yargs.t || 3000;
local_client.on("error", function (err) {
    console.log("redis Error " + err);
});
common_client.on("error", function (err) {
    console.log("remote redis Error " + err);
});

var filterIps = function (key, callback) {
    (key == 'ips' ? common_client : local_client).srandmember(key, function (err, proxyip) {
        if (!proxyip) {
            if(key == 'ips') {
                console.error('there is no ip, please fetch first!');
                process.exit();
            } else {
                sleep(5000);
                return filterIps(key, callback);
            }
        }
        try {
            proxyip = JSON.parse(proxyip);
        } catch (e) {
            return filterIps(key, callback);
        }
        var options = {
            url: 'http://do.tangtaijia.com/verify.html',
            proxy: 'http://' + proxyip.ip + ':' + proxyip.port,
            timeout: filter_timeout
        };
        request(options, function (error, response, html) {
            if (!error && html && html.trim() == 'success') {
                local_client.srem('black_ips', JSON.stringify(proxyip), function (err, reply) {
                    local_client.sadd('white_ips', JSON.stringify(proxyip), function (err, reply) {
                        if (callback)
                            callback(err, reply);
                        filterIps(key, callback);
                    });
                });
            } else {
                console.error(new Date(), 'proxy', JSON.stringify(proxyip), 'error', error);
                local_client.srem('white_ips', JSON.stringify(proxyip), function (err, reply) {
                    local_client.sadd('black_ips', JSON.stringify(proxyip), function (err, reply) {
                        if (callback)
                            callback(err, reply);
                        filterIps(key, callback);
                    });
                });
            }
        });
    });
};

var getRandWhiteIp = exports.getRandWhiteIp = function (pass, callback) {
    if (pass)
        callback(false);
    else {
        local_client.srandmember('white_ips', function (err, reply) {
            if (err) {
                console.error(new Date() + ' get ip error: ' + err);
                callback(false);
            } else {
                try {
                    reply = JSON.parse(reply);
                    if (reply.ip)
                        callback(reply);
                    else
                        return getRandWhiteIp(pass, callback);
                } catch (e) {
                    return getRandWhiteIp(pass, callback);
                }
            }
        });
    }
};

var genIps = function () {
    local_client.scard('white_ips', function (err, reply) {
        console.info('num of white_ips:' + reply);
        if (!reply || reply < 1045) {
            // fetch new ips
            proxyfetcher.runTask(function (domains) {
                util.log('done! fetch domain num', domains.length);
                genIps(); // run again
                sleep(1000);
            });
        } else {
            genIps(); // run again
            sleep(1000);
        }
    });
};

exports.addIps = function (ips, callback) {
    // convert every object value to string
    ips.forEach(function (value, index) {
        ips[index] = JSON.stringify(value);
    });
    // add ips
    common_client.sadd(['ips'].concat(ips), function (err, reply) {
        callback(err, reply);
    });
};

exports.addBlackIp = function (ip, callback) {
    if (!util.isString(ip))
        ip = JSON.stringify(ip);
    local_client.sadd('black_ips', ip, function (err, reply) {
        callback(err, reply);
    });
};

if (yargs.$0 == 'proxyhandler.js') {
    if (filter) {
        filterIps('ips');
        filterIps('black_ips');
        if(white)
            filterIps('white_ips');
    } else {
        genIps();
    }
}