# Overview #
this is a crawler for lagou's company and job informations

# Preparation #
* Nodejs v4.5.0
* Redis server v=3.2.3
* MongoDB v3.2.6

# Descriptions #
1. There are 2 tasks to run. 
  (1) Crawler to fetch informations and save them. 
  (2) Proxy fetcher to fetch thousands of proxies on internet for free, you can make 
      a proxy pool in reids for crawler.
2. You can run this crawler in multiple servers for fetching informations
   and save all in one storage server. As above, you can get all what you
   want more quickly.
3. About 12k jobs and 8k companies have been fetched with this crawler.

# How to run #
1. First, run proxy fetcher, node proxyfetcher.js -tl
2. Second, run crawler, node tasks.js -jc -r 5000,6000 >> lagou.log
