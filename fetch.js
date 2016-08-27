var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var saver = require('./saver');
var jobs = require('./jobs');
var proxy = require('./proxy');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var proxyips = require('./readfiledata')('proxyips.json');
var try_count = 0;

var self = module.exports = function (key, with_job, callback) {
    proxy(function (proxyip) {
        proxy_url = proxyip ? ('http://' + proxyip.ip + ':' + proxyip.port) : 'localhost';
        var options = {
            url: util.format('http://www.lagou.com/gongsi/%s.html', key),
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            maxRedirects: 10,
            timeout: config.timeout
        };
        if(proxy_url != 'localhost')
            options.proxy = proxy_url;
        process.setMaxListeners(0);
        util.log('fetch page: ' + options.url + ', with proxy:' + proxy_url);
        request(options, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html);
                fetchCompany($, key, with_job, function (result) {
                    if (callback)
                        callback(result);
                });
            } else {
                if (response && response.statusCode && response.statusCode == 400) {
                    if (callback)
                        callback(key + ' not found!!');
                } else {
                    ++try_count;
                    if (try_count > 3) {
                        console.error(new Date() + ' fetch company error:' + error + ', key:' + key);
                        proxy.addProxyError(proxyip, error);
                        callback(key + ' not found!!');
                    } else if (callback)
                        self(key, with_job, callback);
                }
            }
        });
    });
};


function fetchCompany($, key, with_job, callback) {
    var title_ele = $('.hovertips');
    if (title_ele.attr('title')) {
        var company = {};
        company.name = title_ele.attr('title');
        company.nick_name = title_ele.text().trim();
        parseCompany($, function (company) {
            company.key = key;
            util.log(key, with_job, company.online_job_num);
            if (with_job && parseInt(company.online_job_num)) {
                jobs(key, 1, function (jobs) {
                    company.jobs = jobs;
                    storeCompany(company, function (result) {
                        if (result)
                            callback(result + ' company: ' + company.name + ' key: ' + key + ' successfully!!!');
                    });
                });
            } else {
                storeCompany(company, function (result) {
                    if (result)
                        callback(result + ' company: ' + company.name + ' key: ' + key + ' successfully!!!');
                });
            }


        });
    } else {
        callback(key + ' not found!!');
    }
}

function parseCompany($, callback) {
    var title_ele = $('.hovertips');
    var company = {};
    company.name = title_ele.attr('title');
    company.nick_name = title_ele.text().trim();
    var company_data_map = {
        0: "online_job_num",
        1: "real_time_rate",
        2: "handle_time",
        3: "interview_comment_num",
        4: "last_login_date"
    };
    $('.company_data li strong').each(function (index, value) {
        company[company_data_map[index]] = $(value).text().trim();
    });

    var products = [];
    $('#company_products .product_details').each(function (index, value) {
        var tags = [];
        $(value).find('.clearfix li').each(function (i, n) {
            tags.push($(n).text().trim());
        });
        var content_p = [];
        $(value).find('.product_profile p').each(function (i, n) {
            if ($(n).text().trim())
                content_p.push($(n).text().trim());
        });
        products.push({
            "name": $(value).find('.product_url .url_valid').text().trim(),
            "url": $(value).find('.product_url .url_valid').attr('href'),
            "tags": tags,
            "content": content_p.length ? ("<p>" + content_p.join("</p><p>") + "</p>") : ""
        });
    });
    company.products = products;

    var desc_p = [];
    $('#company_intro .company_content p').each(function (index, value) {
        if ($(value).text().trim())
            desc_p.push($(value).text().trim());
    });
    company.desc = desc_p.length ? ("<p>" + desc_p.join("</p><p>") + "</p>") : "";

    var history = [];
    $('.history_ul .history_li').each(function (index, value) {
        history.push({
            "time": $(value).find('.date_year').text().trim() + " " + $(value).find('.date_day').text().trim(),
            "tag": $(value).find('.li_type_icon').attr('title'),
            "title": $(value).find('.desc_real_title').text().trim(),
            "desc": $(value).find('.desc_intro').text().trim().replace(/[\n\s]/g, '')
        });
    });
    company.history = history;

    $('#basic_container ul li').each(function (index, value) {
        company[$(value).find('i').attr('class')] = $(value).text().trim();
    });

    var tags = [];
    $('.tags_container ul li').each(function (index, value) {
        tags.push($(value).text().trim());
    });
    company.tags = tags;
    return callback(company);
}

function storeCompany(company, callback) {
    saver(company, 'company', function (type) {
        return callback(type);
    });
}
