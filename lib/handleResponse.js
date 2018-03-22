const handleResponse = (error, response, body, callback) => {
  if (!error && response.statusCode == 200) {
    callback(body);
  } else {
    console.log('Error');
    if (error) console.error(error);
    if (response) console.error(`HTTP Status code: ${response.statusCode}`);
    if (body) console.log(body);
    process.exit(1);
  }
};

module.exports = handleResponse;
