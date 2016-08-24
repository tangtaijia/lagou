var key = process.argv[2];
var fetch = require('./fetch');
if (!key) {
    console.info('please input page index');
    return false;
}
fetch(key, true,function (result) {
    console.log(result);
});

module.exports = function (key) {
    fetch(key, true);
};