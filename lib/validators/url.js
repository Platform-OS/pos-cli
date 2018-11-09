const logger = require('../logger');
const isWebUri = require('valid-url').isWebUri;

module.exports = url => {
  if (!isWebUri(url)) {
    logger.Error('Please provide valid URL', { hideTimestamp: true });
  }
};
