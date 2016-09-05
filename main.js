var key = process.argv[2];
var companyfetcher = require('./companyfetcher');
if (!key) {
    console.info('please input page index');
    return false;
}
companyfetcher(key, true,function (result) {
    console.log(result);
});

module.exports = function (key) {
    companyfetcher(key, true);
};