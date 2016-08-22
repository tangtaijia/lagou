var url = process.argv[2];
var detail = require('./detail');
if (!url) {
    console.info('please input url');
    return false;
}
detail.main(url);