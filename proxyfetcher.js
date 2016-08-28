var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var async = require('async');
var proxy = require('./proxy');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var proxyips = require('./readfiledata')('proxyips.json');

var self = exports = module.exports = function () {
    refreshIps(function (result) {
        if (result)
            util.log('refresh ip result:' + result);
    });
};
var runTask = function (pcallback) {
    async.series([
            function (callback) {
                fetchIps('http://cn-proxy.com/', [], function (url, result) {
                    sleep(2000);
                    fetchIps('http://cn-proxy.com/archives/218', result, function (url, result) {
                        callback(null, result);
                    });
                });
            },
            function (callback) {
                fetchIps('http://proxy.com.ru/', [], function (url, result) {
                    sleep(2000);
                    fetchIps('http://proxy.com.ru/list_2.html', result, function (url, result) {
                        sleep(2000);
                        fetchIps('http://proxy.com.ru/touming/', result, function (url, result) {
                            sleep(2000);
                            fetchIps('http://proxy.com.ru/niming/', result, function (url, result) {
                                sleep(2000);
                                fetchIps('http://proxy.com.ru/gaoni/', result, function (url, result) {
                                    callback(null, result);
                                });
                            });
                        });
                    });
                });
            }
        ],
        function (err, results) {
            var new_ips = [];
            results.forEach(function (value, index) {
                new_ips = new_ips.concat(value);
            });
            util.log('fetch new ips num:' + new_ips.length);
            if (pcallback)
                pcallback(new_ips);
        });
};

var fetchIps = exports.fetchIps = function (url, result, callback) {
    var options = {
        url: url,
        headers: {
            'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
        },
        maxRedirects: 10,
        timeout: config.timeout
    };
    process.setMaxListeners(0);
    request(options, function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);
            parseIps(url, $, function (proxyips_arr) {
                util.log(url, proxyips_arr.length + ' new ips');
                callback(url, result ? result.concat(proxyips_arr) : proxyips_arr);
            });
        } else {
            console.error(new Date() + ' fetch ' + url + ' for new proxy error: ' + error);
            callback(false);
        }
    });
};

var parseIps = function (url, $, callback) {
    var proxyips_arr = [];
    if (url.indexOf('http://cn-proxy.com/') > -1) {
        $('table tbody tr').each(function (index, element) {
            var new_ip = {
                'ip': $(element).find('td').first().text().trim(),
                'port': $(element).find('td').eq(1).text().trim()
            };
            proxyips_arr.push(new_ip);
        });
    } else if (url.indexOf('http://proxy.com.ru/') > -1) {
        $('table').eq(7).children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(1).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(1).text().trim(),
                    'port': $(element).find('td').eq(2).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    }

    callback(proxyips_arr);
};

var refreshIps = exports.refreshIps = function (callback) {
    var remain_ips = require('./readfiledata')('proxyips.json');
    var remainIps = remain_ips && remain_ips.ips ? remain_ips.ips : [];

    if (!remainIps.length || proxy.valid_ips(remain_ips).length < 180) {
        if (remainIps.length)
            proxyips.ips = removeErrorIps();
        if (remainIps.length)
            util.log('proxy ip nums:' + proxy.valid_ips(proxyips).length + '/' + proxyips.ips.length);
        else
            util.log('proxy ip nums:0');
        runTask(function (proxyips_arr) {
            proxyips_arr.forEach(function (value, index) {
                remainIps.forEach(function (remain_ip, r_index) {
                    if (!value) {
                        console.log('value is empty, ' + value + '   ' + index, proxyips_arr);
                    }
                    if (value && remain_ip.ip == value.ip && remain_ip.port == value.port)
                        remainIps.splice(r_index, 1);
                });
            });
            util.log(proxyips_arr.length + ' new ips');
            remainIps = remainIps ? remainIps.concat(proxyips_arr) : proxyips_arr;
            proxy.writeFile('proxyips.json', {"ips": remainIps});
            util.log('rewrite ips, num: ' + remainIps.length);
            sleep(30000);
            refreshIps(callback);
        });
    } else {
        util.log('ips ok, : ' + proxy.valid_ips(remain_ips).length + '/' + remainIps.length);
        sleep(30000);
        refreshIps(callback);
    }

};

var removeErrorIps = exports.removeErrorIps = function () {
    var change = false;
    var remainIps = [];

    require('./readfiledata')('proxyips.json').ips.forEach(function (item, index) {
        if (item.errors)
            change = true;
        else
            remainIps.push(item);
    });

    if (change) {
        proxy.writeFile('proxyips.json', {"ips": remainIps});
    }
    return remainIps;
};

// self();