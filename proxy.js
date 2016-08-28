var taskworker = require('./taskworker');

exports = module.exports = function (callback) {
    taskworker.gen_ips();
};

taskworker.gen_ips();