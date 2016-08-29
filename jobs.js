var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var taskworker = require('./taskworker');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var pageSize = 10;
var jobs = [];
var try_count = 0;
var self = module.exports = function (key, pageNo, callback) {
    taskworker.getValidIp(function (proxyip) {
        proxy_url = proxyip ? ('http://' + proxyip.ip + ':' + proxyip.port) : 'localhost';
        var options = {
            url: 'http://www.lagou.com/gongsi/searchPosition.json',
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            maxRedirects: 10,
            timeout: config.timeout,
            form: {
                companyId: key,
                pageNo: pageNo,
                pageSize: pageSize,
                positionFirstType: "全部"
            }
        };
        if (proxy_url != 'localhost' && 0)
            options.proxy = proxy_url;
        process.setMaxListeners(0);
        request.post(options, function (error, response, html) {
            if (!error) {
                if (response.statusCode == 302 || html.indexOf('DOCTYPE') > -1 || html.indexOf('<html><head>') > -1) {
                    ++try_count;
                    if (try_count > 3) {
                        console.error(new Date() + ' fetch job error, status code: ' + response.statusCode + ', proxy_url:' + proxy_url);
                        callback(jobs);
                    } else {
                        self(key, options.form.pageNo, callback);
                        sleep(8000);
                    }
                } else {
                    var result = JSON.parse(html);
                    pageCount = parseInt(result.content.data.page.totalCount / pageSize) + (result.content.data.page.totalCount % pageSize ? 1 : 0);
                    util.log('fetch joblist json with proxy: ' + proxy_url + ', page:' + options.form.pageNo + '/' + pageCount + ', key:' + key);
                    jobs = jobs.concat(result.content.data.page.result);
                    ++options.form.pageNo;
                    if (options.form.pageNo < pageCount) {
                        self(key, options.form.pageNo, callback);
                        sleep(8000);
                    } else
                        callback(jobs);
                }
            } else {
                console.error(new Date() + ' fetch job error: ' + error + ', proxy_url:' + proxy_url);
                if (callback)
                    callback(jobs);
            }
        });
    });
};
