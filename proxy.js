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
    if (proxyips.ips) {
        if (valid_ips(proxyips).length > 10) {
            var random_index = Math.floor(Math.random() * (proxyips.ips.length - 1)) + 1;
            verify(proxyips.ips, random_index, verify_count, function (proxyip) {
                callback(proxyip);
            });
        } else {
            proxyips.ips = removeErrorIps();
            util.log('proxy ip nums:' + valid_ips(proxyips).length + '/' + proxyips.ips.length);
            addNewIps(callback);
        }
    } else {
        addNewIps(callback);
    }
};

var valid_ips = function (proxyips) {
    return proxyips.ips.filter(function (value) {
        return !value.errors;
    });
};

var addNewIps = exports.addNewIps = function (callback) {
    var remain_ips = require('./readfiledata')('proxyips.json');
    var remainIps = remain_ips ? remain_ips.ips : [];
    var options = {
        url: 'http://cn-proxy.com/',
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
            var proxyips_arr = [];
            $('table tbody tr').each(function (index, element) {
                var new_ip = {
                    'ip': $(element).find('td').first().text(),
                    'port': $(element).find('td').eq(1).text()
                };
                proxyips_arr.push(new_ip);
                remainIps.forEach(function (remain_ip, r_index) {
                    if(remain_ip.ip == new_ip.ip && remain_ip.port == new_ip.port)
                        remainIps.splice(r_index, 1);
                });
            });
            util.log(proxyips_arr.length + ' new ips');
            remainIps = remainIps ? remainIps.concat(proxyips_arr) : proxyips_arr;
            writeFile('proxyips.json', {"ips": remainIps});
            var random_index = Math.floor(Math.random() * (remainIps.length - 1)) + 1;
            verify(remainIps, random_index, 0, function (proxyip) {
                callback(proxyip);
            });
        } else {
            console.error(new Date() + ' fetch new proxy error: ' + error);
            callback(false);
        }
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
        writeFile('proxyips.json', {"ips": remainIps});
    }
    return remainIps;
};

var writeFile = function (file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};