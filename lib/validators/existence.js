import logger from '../logger.js';
const noop = () => {};

const existence = ({ argumentName = 'all required arguments', argumentValue, fail = noop }) => {
  if (typeof argumentValue === 'undefined') {
    fail();
    logger.Error(`Please provide ${argumentName}`, { hideTimestamp: true });
  }
};

export default existence;
