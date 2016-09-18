var companyId = process.argv[2];
var companyfetcher = require('./companyfetcher');
if (!companyId) {
    console.info('please input page index');
    return false;
}
companyfetcher(companyId, true,function (result) {
    console.log(result);
});

module.exports = function (companyId) {
    companyfetcher(companyId, true);
};