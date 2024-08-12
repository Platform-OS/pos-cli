const logger = require('../logger');
const URL = require('url').URL;

module.exports = string => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    logger.Error('Please provide valid URL', { hideTimestamp: true });
    return false;
  }
};
