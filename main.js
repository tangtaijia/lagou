var key = process.argv[2];
var fetch = require('./fetch');
if (!key) {
    console.info('please input page index');
    return false;
}
fetch(key);

module.exports = function (key) {
    fetch(key);
};