const logger = require('../kit').logger;
const shell = require('shelljs');
const noop = () => {};

module.exports = ({ path, message = 'Directory is empty.', fail = noop }) => {
  const directoryEmpty = shell.ls(path).length == 0;

  if (directoryEmpty) {
    logger.Error(message, { hideTimestamp: true });
    fail();
    process.exit(1);
  }
};
