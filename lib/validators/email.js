const logger = require('../logger');
const emailValidator = require('email-validator');

module.exports = email => {
  if (!emailValidator.validate(email)) {
    logger.Error('Please provide valid email', { hideTimestamp: true });
  }
};
