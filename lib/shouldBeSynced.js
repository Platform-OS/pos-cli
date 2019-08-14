const fs = require('fs'),
  path = require('path');

const watchFilesExtensions = require('./watch-files-extensions'),
  files = require('./files'),
  report = require('./logger/report'),
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
    report('Sync', { extras: [{ key: 'invalidExtension', value: ext(filePath) }] });
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
  if (path.basename(filePath) === files.templateValues) {
    return true;
  }

  if (filePath.startsWith('modules')) {
    const re = win ? /^modules\\.*\\(public|private)/ : /^modules\/.*\/(public|private)/;
    return re.test(filePath);
  }

  return false;
};

module.exports = filePath => {
  return isValidExtension(filePath) && isNotEmptyYML(filePath) && isValidModuleFile(filePath);
};
