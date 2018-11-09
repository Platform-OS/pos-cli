const logger = require('../logger');
const fs = require('fs');
const noop = () => {};

module.exports = ({ path, message = "Directory doesn't exist.", fail = noop }) => {
  const directoryExists = fs.existsSync(path);

  if (!directoryExists) {
    fail();
    logger.Error(message, { hideTimestamp: true });
  }
};
