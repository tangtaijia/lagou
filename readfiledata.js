var fs = require('fs');
exports = module.exports = function (file) {
    if (!fs.existsSync(file))
        fs.closeSync(fs.openSync(file, 'w'));
    var content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : [];
};