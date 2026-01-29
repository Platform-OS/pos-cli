import logger from '../logger.js';
import fs from 'fs';
const noop = () => {};

const directoryExists = ({ path, message = "Directory doesn't exist.", fail = noop }) => {
  const directoryExists = fs.existsSync(path);

  if (!directoryExists) {
    fail();
    logger.Error(message, { hideTimestamp: true });
  }
};

export default directoryExists;
