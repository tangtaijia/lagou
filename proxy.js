var taskworker = require('./taskworker');
var redis = require('redis');
var client = redis.createClient();
var fs = require('fs');
var sleep = require('system-sleep');
var request = require('request');
var cheerio = require('cheerio');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var yargs = require('yargs').argv;
var test = yargs.d || false;
client.on("error", function (err) {
    console.log("Error " + err);
});

var filterIps = module.exports = function (key, callback) {
    client.srandmember(key, function (err, proxyip) {
        if (!proxyip) {
            console.error('there is no ip, please fetch first!');
            process.exit();
        }
        try {
            proxyip = JSON.parse(proxyip);
        } catch (e) {
            return filterIps(callback);
        }
        var options = {
            url: 'http://do.tangtaijia.com/verify.html',
            proxy: 'http://' + proxyip.ip + ':' + proxyip.port,
            timeout: 3000
        };
        request(options, function (error, response, html) {
            if (!error && html && html.trim() == 'success') {
                // console.info(proxyip, html);
                client.srem('black_ips', JSON.stringify(proxyip), function (err, reply) {
                    // console.log('remove black',proxyip, reply);
                    client.sadd('white_ips', JSON.stringify(proxyip), function (err, reply) {
                        // console.log('add white',proxyip, reply);
                        if (callback)
                            callback(err, reply);
                        filterIps(key);
                    });
                });
            } else {
                console.error(new Date(), 'proxy', JSON.stringify(proxyip), 'error', error);
                client.srem('white_ips', JSON.stringify(proxyip), function (err, reply) {
                    // console.log('remove white',proxyip, reply);
                    client.sadd('black_ips', JSON.stringify(proxyip), function (err, reply) {
                        // console.log('add black',proxyip, reply);
                        if (callback)
                            callback(err, reply);
                        filterIps(key);
                    });
                });
            }
        });
    });
};

if (test) {
    filterIps('ips');
    filterIps('white_ips');
    filterIps('black_ips');
} else {
    taskworker.gen_ips();
}