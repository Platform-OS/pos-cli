const fs = require('fs'),
  path = require('path');

const watchFilesExtensions = require('./watch-files-extensions'),
  files = require('./files'),
  logger = require('./logger');

const win = path.sep === path.win32.sep;

// path.extname returns ext with . ~_~
const ext = filePath => filePath.split('.').pop();

const isEmpty = filePath =>
  fs
    .readFileSync(filePath)
    .toString()
    .trim().length === 0;

const isValidExtension = filePath => {
  const valid = watchFilesExtensions.includes(ext(filePath));
  if (!valid) {
    logger.Warn(`[Sync] Not recognized extension: ${filePath}. Not syncing.`);
  }
  return valid;
};

const isNotEmptyYML = filePath => {
  if (ext(filePath) === 'yml' && isEmpty(filePath)) {
    logger.Warn(`[Sync] Detected empty YML file: ${filePath}. Not syncing.`);
    return false;
  }

  return true;
};

const isValidModuleFile = filePath => {
  // Accept template values json file
  if (path.basename(filePath) === files.templateValues) {
    return true;
  }

  // In modules/* accept only files from public and private folders, reject rest
  if (filePath.startsWith('modules')) {
    const re = win ? /^modules\\.*\\(public|private)/ : /^modules\/.*\/(public|private)/;
    return re.test(filePath);
  } else {
    return true; // If its not file in modules/, accept
  }
};

module.exports = filePath => {
  return isValidExtension(filePath) && isNotEmptyYML(filePath) && isValidModuleFile(filePath);
};
