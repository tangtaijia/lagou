var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var async = require('async');
var taskworker = require('./taskworker');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var yargs = require('yargs').argv;
var test = yargs.t || false;
var detail = yargs.d || false;
var try_count = 0;

var runTask = exports.runTask = function (pcallback) {
    var callbacks = [];
    callbacks.push(function (callback) {
        fetchIps('http://cn-proxy.com/', [], function (url, result) {
            sleep(5000);
            fetchIps('http://cn-proxy.com/archives/218', result, function (url, result) {
                callback(null, result);
            });
        });
    });
    callbacks.push(function (callback) {
        fetchIps('http://proxy.com.ru/', [], function (url, result) {
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
    callbacks.push(function (callback) {
        fetchIps('http://www.xicidaili.com/nn/', [], function (url, result) {
            sleep(3000);
            fetchIps('http://www.xicidaili.com/nt/', result, function (url, result) {
                sleep(3000);
                fetchIps('http://www.xicidaili.com/wn/', result, function (url, result) {
                    sleep(3000);
                    fetchIps('http://www.xicidaili.com/wt/', result, function (url, result) {
                        callback(null, result);
                    });
                });
            });
        });
    });
    callbacks.push(function (callback) {
        fetchIps('http://www.kuaidaili.com/free/', [], function (url, result) {
            callback(null, result);
        });
    });
    async.series(callbacks,
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

var fetchIps = function (url, result, callback) {
    taskworker.getValidIp(false, function (proxyip) {
        var proxy_url = proxyip ? ('http://' + proxyip.ip + ':' + proxyip.port) : 'localhost';
        var options = {
            url: url,
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            maxRedirects: 10,
            timeout: config.timeout
        };
        if (proxy_url != 'localhost')
            options.proxy = proxy_url;
        process.setMaxListeners(0);
        request(options, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html);
                parseIps(url, $, function (proxyips_arr) {
                    util.log(url, proxyips_arr.length + ' new ips' + ', with proxy:' + proxy_url);
                    var redirect = false;
                    var current_page;
                    var next_page;
                    var current_uri = response.request.uri;
                    if (url.indexOf('http://www.xicidaili.com/') > -1) {
                        current_page = $('.pagination .current');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text() < 6) {
                            redirect = true;
                            url = current_uri.protocol + '//' + current_uri.host + '/' + next_page.attr('href');
                            fetchIps(url,
                                result ? result.concat(proxyips_arr) : proxyips_arr,
                                callback);
                            sleep(1500);
                        }
                    } else if (url.indexOf('http://proxy.com.ru/') > -1) {
                        current_page = $('font[color="red"]');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            redirect = true;
                            var path = current_uri.path.lastIndexOf('/') == current_uri.path.length - 1 ? current_uri.path : '';
                            url = current_uri.protocol + '//' + current_uri.host + path + next_page.attr('href');
                            fetchIps(url,
                                result ? result.concat(proxyips_arr) : proxyips_arr,
                                callback);
                            sleep(1500);
                        }
                    } else if (url.indexOf('http://www.kuaidaili.com/') > -1) {
                        current_page = $('div#listnav a.active');
                        next_page = current_page.closest('li').next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            redirect = true;
                            url = current_uri.protocol + '//' + current_uri.host + next_page.find('a').attr('href');
                            console.info('fetching ' + url);
                            fetchIps(url,
                                result ? result.concat(proxyips_arr) : proxyips_arr,
                                callback);
                            sleep(1500);
                            return false;
                        }
                    }
                    if (!redirect) {
                        console.info('fetching ' + url);
                        callback(url, result ? result.concat(proxyips_arr) : proxyips_arr);
                    }
                });
            } else {
                console.info('error , now url is: ' + url);
                if (response && response.statusCode && response.statusCode == 400) {
                    if (callback) {
                        console.info('now num:' + result.length + ', count:' + try_count + ', error:' + error);
                        console.info('fetching ' + url);
                        fetchIps(url, result, callback);
                        sleep(1500);
                    }
                } else {
                    ++try_count;
                    if (try_count > 3) {
                        console.error(new Date() + ' fetch ' + url + ' for new proxy error: ' + error + ', with proxy:' + proxy_url);
                        // taskworker.addInvalid(JSON.stringify(proxyip), function (err, reply) {
                        //     callback(url, []);
                        // });
                        callback(url, []);
                    } else if (callback) {
                        console.info('now num:' + result.length + ', count:' + try_count + ',error' + error);
                        console.info('fetching ' + url);
                        fetchIps(url, result, callback);
                        sleep(1500);
                    }
                }
            }
        });
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
    } else if (url.indexOf('http://www.xicidaili.com/') > -1) {
        $('#ip_list').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(1).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(1).text().trim(),
                    'port': $(element).find('td').eq(2).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (url.indexOf('http://www.kuaidaili.com/') > -1) {
        $('#list table').children('tbody').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(0).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(0).text().trim(),
                    'port': $(element).find('td').eq(1).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    }

    callback(proxyips_arr);
};

if (test) {
    runTask(function (proxyips) {
        if (detail)
            console.log(JSON.stringify(proxyips, null, 2));
        console.log('fetch ip num:' + proxyips.length);
        taskworker.addIps(proxyips,  function (err, reply) {
            console.info('save ' + reply + ' new ips');
            process.exit();
        });
    });
}