const handleResponse = (error, response, body, callback) => {
  if (!error && response.statusCode == 200) {
    callback(body);
  } else {
    logger.Error('Error');
    if (error) logger.Error(error);
    if (response) logger.Error(`HTTP Status code: ${response.statusCode}`);
    if (body) logger.Error(body);
    process.exit(1);
  }
};

module.exports = handleResponse;
