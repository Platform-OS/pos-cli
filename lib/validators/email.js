import logger from '../logger.js';
import emailValidator from 'email-validator';

const email = email => {
  if (!emailValidator.validate(email)) {
    logger.Error('Please provide valid email', { hideTimestamp: true });
  }
};

export default email;
