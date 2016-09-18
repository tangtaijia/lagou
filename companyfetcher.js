var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var sleep = require('system-sleep');
var util = require('util');
var saver = require('./saver');
var jobfetcher = require('./jobfetcher');
var proxyhandler = require('./proxyhandler');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var yargs = require('yargs').argv;
var local = yargs.l || false;
var try_count = 0;

var self = module.exports = function (companyId, with_job, callback) {
    proxyhandler.getRandWhiteIp(local, function (proxyip) {
        var proxy_url = proxyip ? ('http://' + proxyip.ip + ':' + proxyip.port) : 'localhost';
        var options = {
            url: util.format('http://www.lagou.com/gongsi/%s.html', companyId),
            headers: {
                'User-Agent': config.ualist[Math.floor(Math.random() * (config.ualist.length - 1)) + 1]
            },
            maxRedirects: 10,
            timeout: config.timeout
        };
        if (proxy_url != 'localhost')
            options.proxy = proxy_url;
        process.setMaxListeners(0);
        util.log('fetch company url: ' + options.url + ', with proxy:' + proxy_url);
        request(options, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html);
                fetchCompany($, companyId, with_job, function (result) {
                    if (callback)
                        callback(result);
                });
            } else {
                if (response && response.statusCode && response.statusCode == 400) {
                    if (callback)
                        callback(companyId + ' not found!!');
                } else {
                    ++try_count;
                    if (try_count > 3) {
                        console.error(new Date() + ' fetch company error:' + error + ', companyId:' + companyId);
                        proxyhandler.addBlackIp(proxyip, function (err, reply) {
                            callback(companyId + ' not found!!');
                        });
                    } else if (callback)
                        self(companyId, with_job, callback);
                }
            }
        });
    });
};


function fetchCompany($, companyId, with_job, callback) {
    var title_ele = $('.hovertips');
    if (title_ele.attr('title')) {
        var company = {};
        company.name = title_ele.attr('title');
        company.nick_name = title_ele.text().trim();
        parseCompany($, function (company) {
            company.companyId = companyId;
            if (with_job && parseInt(company.online_job_num)) {
                company.online_job_num = parseInt(company.online_job_num);
                jobfetcher(companyId, 1, function (jobs) {
                    var job_num = jobs.length;
                    storeJobs(jobs, function (jobs_result) {
                        if (jobs_result)
                            util.log('company: ' + company.name + ' companyId: ' + companyId + ', ' + jobs_result + ' ' + job_num + ' jobs successfully!!!');
                    });
                    storeCompany(company, function (result) {
                        if (result)
                            callback(result + ' company: ' + company.name + ' companyId: ' + companyId + ' and ' + job_num + ' jobs successfully!!!');
                    });
                });
            } else {
                storeCompany(company, function (result) {
                    if (result)
                        callback(result + ' company: ' + company.name + ' companyId: ' + companyId + ' successfully!!!');
                });
            }


        });
    } else {
        callback(companyId + ' not found!!');
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

function storeJobs(jobs, callback) {
    var job = jobs.pop();
    if(!job || !job.salary ||!job.companySize ||!job.workYear)
        return callback('null job');
    var salaryarr = job.salary.split('-');
    var sizearr = job.companySize.split('-');
    var yeararr = job.workYear.split('-');
    if(salaryarr && salaryarr.length) {
        job.max_salary = parseInt(salaryarr.pop());
        job.min_salary = parseInt(salaryarr.pop());
    }
    if(sizearr && sizearr.length) {
        job.max_size = parseInt(sizearr.pop());
        job.min_size = parseInt(sizearr.pop());
    }
    if(salaryarr && salaryarr.length) {
        job.max_year = parseInt(yeararr.pop());
        job.min_year = parseInt(yeararr.pop());
    }
    saver(job, 'job', function (type) {
        if(jobs.length)
            storeJobs(jobs, callback);
        else
            return callback(type);
    });
}
