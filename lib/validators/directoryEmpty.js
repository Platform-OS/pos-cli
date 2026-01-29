import logger from '../logger.js';
import shell from 'shelljs';
const noop = () => {};

const directoryEmpty = ({ path, message = 'Directory is empty.', fail = noop }) => {
  const directoryEmpty = shell.ls(path).length == 0;

  if (directoryEmpty) {
    fail();
    logger.Error(message, { hideTimestamp: true });
  }
};

export default directoryEmpty;
