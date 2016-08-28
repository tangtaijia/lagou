var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var proxyips = require('./readfiledata')('proxyips.json');
var verify_count = 0;

exports = module.exports = function (callback) {
    proxyips = require('./readfiledata')('proxyips.json');
    if (proxyips.ips) {
        var random_index = Math.floor(Math.random() * (proxyips.ips.length - 1)) + 1;
        verify(proxyips.ips, random_index, verify_count, function (proxyip) {
            callback(proxyip);
        });
    } else {
        callback(false);
    }
};

var valid_ips = exports.valid_ips = function (proxyips) {
    return proxyips.ips.filter(function (value) {
        return !value.errors;
    });
};

var verify = exports.verify = function (proxyips, index, verify_count, callback) {
    index = index >= proxyips.length ? 0 : index;
    var proxyip = proxyips[index];
    if (proxyip.errors) {
        verify(proxyips, ++index, verify_count, callback);
    } else if (++verify_count > proxyips.length) {
        callback(false);
    } else {
        var options = {
            url: 'http://do.tangtaijia.com/',
            proxy: 'http://' + proxyip.ip + ':' + proxyip.port,
            timeout: config.timeout
        };
        request(options, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html);
                if ($('title').html() && $('title').html().indexOf('Nginx') > -1)
                    callback(proxyip);
                else
                    verify(proxyips, ++index, verify_count, callback);
            } else {
                console.error(new Date() + ' verify proxy ' + JSON.stringify(proxyip) + ' ' + error);
                addProxyError(proxyip, error);
                verify(proxyips, ++index, verify_count, callback);
            }
        });
    }
};

var addProxyError = exports.addProxyError = function (proxyip, error) {
    var change = false;
    if (proxyip) {
        proxyips.ips.forEach(function (item, index) {
            if (item.ip == proxyip.ip && item.port == proxyip.port) {
                change = true;
                var ownerror = false;
                var errors = item.errors;
                if (errors) {
                    errors.forEach(function (eitem, eindex) {
                        if (eitem.code == error.code) {
                            ownerror = true;
                            proxyips.ips[index].errors[eindex]['count']++;
                        }
                    });
                } else
                    proxyips.ips[index]['errors'] = [];
                if (!errors || !ownerror) {
                    proxyips.ips[index].errors.push({'code': error.code, 'count': 1});
                }
            }
        });
    }

    if (change) {
        util.log('rewrite proxyips nums:' + valid_ips(proxyips).length + '/' + proxyips.ips.length);
        writeFile('proxyips.json', proxyips);
    }
};

var writeFile = exports.writeFile = function (file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};