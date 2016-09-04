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
var local = yargs.l || false;
var try_count = 0;
var urlsArr = [
    ['http://cn-proxy.com/', 'http://cn-proxy.com/archives/218'],
    ['http://proxy.com.ru/', 'http://proxy.com.ru/touming/', 'http://proxy.com.ru/niming/', 'http://proxy.com.ru/gaoni/'],
    ['http://www.xicidaili.com/nn/', 'http://www.xicidaili.com/nt/', 'http://www.xicidaili.com/wn/', 'http://www.xicidaili.com/wt/'],
    ['http://www.kuaidaili.com/free/'],
    ['http://proxylist.hidemyass.com/'],
    ['https://incloak.com/proxy-list/?country=CNJPKRTWUS&type=h'],
    ['https://www.us-proxy.org/', 'http://www.sslproxies.org/', 'http://free-proxy-list.net/uk-proxy.html', 'http://free-proxy-list.net/anonymous-proxy.html'],
    ['http://gatherproxy.com/proxylist/country/?c=China', 'http://gatherproxy.com/proxylist/country/?c=United%20States', 'http://gatherproxy.com/proxylist/country/?c=Taiwan'],
    ['http://proxydb.net/']
];

var runTask = exports.runTask = function (pcallback) {
    var callbacks = [];
    var callbacksArr = [];
    urlsArr.forEach(function (urls, index) {
        callbacks = [];
        urls.forEach(function (url, uindex) {
            callbacks.push(function (callback) {
                sleep(100);
                fetchIps(url, callback);
            });
        });
        callbacksArr.push(callbacks);
    });

    async.mapLimit(callbacksArr, 5, function (callbacks, callback) {
        async.series(callbacks,
            function (err, results) {
                callback(null, results);
            });
    }, function (err, result) {
        if (pcallback)
            pcallback(result);
    });
};

var saveIps = function (result, url, callback) {
    if (detail)
        util.log(JSON.stringify(result, null, 2));
    util.log(url, 'fetch', result.length);
    if (result && result.length) {
        taskworker.addIps(result, function (err, reply) {
            util.log(url, 'save', reply);
            if (callback)
                callback(null, result);
        });
    } else if (callback)
        callback(null, result);

};

var fetchIps = function (url, callback) {
    taskworker.getValidIp(local, function (proxyip) {
        var proxy_url = proxyip ? ('http://' + proxyip.ip + ':' + proxyip.port) : 'localhost';
        util.log(url, 'fetching... with proxy: ' + proxy_url);
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
                    var current_page;
                    var next_page;
                    var current_uri = response.request.uri;
                    var nexturl = '';
                    if (url.indexOf('http://www.xicidaili.com/') > -1) {
                        current_page = $('.pagination .current');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text() < 6) {
                            nexturl = current_uri.protocol + '//' + current_uri.host + '/' + next_page.attr('href');
                        }
                    } else if (url.indexOf('http://proxy.com.ru/') > -1) {
                        current_page = $('font[color="red"]');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            var path = current_uri.path.lastIndexOf('/') == current_uri.path.length - 1 ? current_uri.path : '';
                            nexturl = current_uri.protocol + '//' + current_uri.host + path + next_page.attr('href');
                        }
                    } else if (url.indexOf('http://www.kuaidaili.com/') > -1) {
                        current_page = $('div#listnav a.active');
                        next_page = current_page.closest('li').next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            nexturl = current_uri.protocol + '//' + current_uri.host + next_page.find('a').attr('href');
                        }
                    } else if (url.indexOf('http://proxylist.hidemyass.com/') > -1) {
                        current_page = $('ul.pagination li.current');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            nexturl = current_uri.protocol + '//' + current_uri.host + next_page.find('a').attr('href');
                        }
                    } else if (url.indexOf('http://proxydb.net/') > -1) {
                        current_page = $('ul.pagination li.active');
                        next_page = current_page.next();
                        if (next_page.length && next_page.text().replace(/[^\d]/g, '') < 6) {
                            nexturl = current_uri.protocol + '//' + current_uri.host + next_page.find('a').attr('href');
                        }
                    }

                    var nextcall = callback;
                    if (nexturl) {
                        nextcall = function () {
                            fetchIps(nexturl, callback);
                            sleep(4000);
                        };
                    }
                    saveIps(proxyips_arr, url, nextcall);
                });
            } else {
                console.error('error , now url is: ' + url);
                if (response && response.statusCode && response.statusCode == 400) {
                    if (callback) {
                        console.error(url + ' count:' + try_count + ', error:' + error);
                        fetchIps(url, callback);
                        sleep(1500);
                    }
                } else {
                    ++try_count;
                    if (try_count > 3) {
                        console.error(url + new Date() + ' fetch ' + ' for new proxy error: ' + error + ', with proxy:' + proxy_url);
                        callback([]);
                    } else if (callback) {
                        console.error(url + ' count:' + try_count + ', error:' + error);
                        fetchIps(url, callback);
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
    } else if (url.indexOf('http://proxylist.hidemyass.com/') > -1) {
        $('#listable table').children('tbody').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(1).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(1).text().trim(),
                    'port': $(element).find('td').eq(2).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (url.indexOf('https://incloak.com/proxy-list/') > -1) {
        $('.proxy__t').children('tbody').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(0).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(0).text().trim(),
                    'port': $(element).find('td').eq(1).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (
        url.indexOf('www.us-proxy.org') > -1 ||
        url.indexOf('www.sslproxies.org') > -1 ||
        url.indexOf('free-proxy-list.net') > -1
    ) {
        $('#proxylisttable').children('tbody').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('td').eq(0).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(0).text().trim(),
                    'port': $(element).find('td').eq(1).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (url.indexOf('http://gatherproxy.com/proxylist/country/') > -1) {
        $('.proxy-list .table').children('ul').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('li').eq(1).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(1).text().trim(),
                    'port': $(element).find('td').eq(2).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (url.indexOf('https://hidester.com/proxylist/') > -1) {
        $('.proxyListTable table').children('tr').each(function (index, element) {
            if (/[\d{1,3}\.]/.test($(element).find('li').eq(1).text().trim())) {
                var new_ip = {
                    'ip': $(element).find('td').eq(1).text().trim(),
                    'port': $(element).find('td').eq(2).text().trim()
                };
                proxyips_arr.push(new_ip);
            }
        });
    } else if (url.indexOf('http://proxydb.net/') > -1) {
        $('.table-responsive table').children('tbody').children('tr').each(function (index, element) {
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
    runTask(function (domains) {
        util.log('done! fetch domain num', domains.length);
        process.exit();
    });
}