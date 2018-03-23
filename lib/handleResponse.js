const log = require('./lib/logFormat');

const handleResponse = (error, response, body, callback) => {
  if (!error && response.statusCode == 200) {
    callback(body);
  } else {
    log.Error('Error');
    if (error) log.Error(error);
    if (response) log.Error(`HTTP Status code: ${response.statusCode}`);
    if (body) log.Error(body);
    process.exit(1);
  }
};

module.exports = handleResponse;
