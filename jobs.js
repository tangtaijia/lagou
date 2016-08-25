var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var proxy = require('./proxy');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var pageSize = 10;
var jobs = [];
var self = module.exports = function (key, pageNo, callback) {
    proxy(function (proxy_url) {
        var options = {
            url: 'http://www.lagou.com/gongsi/searchPosition.json',
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            proxy:proxy_url,
            maxRedirects: 10,
            form: {
                companyId: key,
                pageNo: pageNo,
                pageSize: pageSize,
                positionFirstType: "全部"
            }
        };
        process.setMaxListeners(0);
        request.post(options, function (error, response, html) {
            if (!error) {
                if(html.indexOf('DOCTYPE') > -1) {
                    self(key, options.form.pageNo, callback);
                } else {
                    var result = JSON.parse(html);
                    pageCount = parseInt(result.content.data.page.totalCount / pageSize) + (result.content.data.page.totalCount % pageSize ? 1 : 0);
                    util.log('fetch joblist json with proxy: ' + proxy_url + ', page:' + options.form.pageNo + '/' + pageCount + ', key:' + key);
                    jobs = jobs.concat(result.content.data.page.result);
                    if (options.form.pageNo < pageCount) {
                        sleep(5000);
                        self(key, ++options.form.pageNo, callback);
                    }
                    else
                        callback(jobs);
                }
            } else {
                console.error(error);
                if (callback)
                    callback(jobs);
            }
        });        
    });
};
