import logger from '../logger.js';
import fs from 'fs';
const noop = () => {};

const directoryEmpty = ({ path, message = 'Directory is empty.', fail = noop }) => {
  // Like `ls`: a missing directory counts as empty, and dotfiles are not counted
  const directoryEmpty = !fs.existsSync(path) || fs.readdirSync(path).filter(f => !f.startsWith('.')).length === 0;

  if (directoryEmpty) {
    fail();
    logger.Error(message, { hideTimestamp: true });
  }
};

export default directoryEmpty;
