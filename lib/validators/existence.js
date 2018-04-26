const logger = require('../kit').logger;
const noop = () => {};

module.exports = ({ argumentName = 'all required arguments', argumentValue, fail = noop }) => {
  if (typeof argumentValue === 'undefined') {
    logger.Error(`Please provide ${argumentName}`, { hideTimestamp: true });
    fail();
    process.exit(1);
  }
};
