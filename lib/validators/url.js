import logger from '../logger.js';
import { URL } from 'url';

const validateUrl = string => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    logger.Error('Please provide valid URL', { hideTimestamp: true });
    return false;
  }
};

export default validateUrl;
