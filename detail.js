var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');

var ualist = [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/22.0.1207.1 Safari/537.1",
    "Mozilla/5.0 (X11; CrOS i686 2268.111.0) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.57 Safari/536.11",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.6 (KHTML, like Gecko) Chrome/20.0.1092.0 Safari/536.6",
    "Mozilla/5.0 (Windows NT 6.2) AppleWebKit/536.6 (KHTML, like Gecko) Chrome/20.0.1090.0 Safari/536.6",
    "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/19.77.34.5 Safari/537.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/19.0.1084.9 Safari/536.5",
    "Mozilla/5.0 (Windows NT 6.0) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/19.0.1084.36 Safari/536.5",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1063.0 Safari/536.3",
    "Mozilla/5.0 (Windows NT 5.1) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1063.0 Safari/536.3",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_0) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1063.0 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.2) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1062.0 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1062.0 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.2) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1061.1 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1061.1 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1061.1 Safari/536.3",
    "Mozilla/5.0 (Windows NT 6.2) AppleWebKit/536.3 (KHTML, like Gecko) Chrome/19.0.1061.0 Safari/536.3",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.24 (KHTML, like Gecko) Chrome/19.0.1055.1 Safari/535.24",
    "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/535.24 (KHTML, like Gecko) Chrome/19.0.1055.1 Safari/535.24"
];
exports.main = function (url, callback) {
    var options = {
        url: url,
        headers: {
            'User-Agent': ualist[Math.floor(Math.random() * (ualist.length - 1)) + 1]
        },
        maxRedirects: 10
    };
    request(options, function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);
            fetchCompany($);
            if(callback)
                callback.call();

        } else {
            console.info(error);
        }
    });
    
}; 


function fetchCompany($) {
    var title_ele = $('.hovertips');
    if(title_ele.attr('title')) {
        var company = {};
        company.name = title_ele.attr('title');
        company.nick_name = title_ele.text().trim();
        parseCompany($,function (company) {
            storeCompany(company,function (result) {
                if(result)
                    util.log('store company:' + company.name+' successfully!!!');
            });
        });
    }
}

function parseCompany($,callback) {
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
            if($(n).text().trim())
                content_p.push($(n).text().trim()); 
        });
        products.push({
            "name":$(value).find('.product_url .url_valid').text().trim(),
            "url":$(value).find('.product_url .url_valid').attr('href'),
            "tags":tags,
            "content": "<p>" + content_p.join("</p><p>") + "</p>"
        });
    });
    company.products = products;
    
    var desc_p = [];
    $('#company_intro .company_content p').each(function (index, value) {
        if($(value).text().trim())
            desc_p.push($(value).text().trim());
    });
    company.desc = "<p>" + desc_p.join("</p><p>") + "</p>";
    
    var history = [];
    $('.history_ul .history_li').each(function (index, value) {
        history.push({
            "time":$(value).find('.date_year').text().trim() + " " + $(value).find('.date_day').text().trim(),
            "tag":$(value).find('.li_type_icon').attr('title'),
            "title":$(value).find('.desc_real_title').text().trim(),
            "desc":$(value).find('.desc_intro').text().trim().replace(/[\n\s]/g,'')
        });
    });
    company.history = history;
    return callback(company);
}

function storeCompany(company,callback) {
    util.log('TO store company:');
    console.info(JSON.stringify(company,null,2));
    return callback(true);
}