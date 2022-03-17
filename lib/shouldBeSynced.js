const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

const watchFilesExtensions = require('./watch-files-extensions'),
  files = require('./files'),
  logger = require('./logger'),
  isValidFilePath = require('./utils/valid-file-path');

const win = path.sep === path.win32.sep;

// path.extname returns ext with . ~_~
const ext = filePath => filePath.split('.').pop();

const isEmpty = filePath => {
  let isEmpty;
  try {
    isEmpty =
      fs
        .readFileSync(filePath)
        .toString()
        .trim().length === 0;
  } catch (err) {
    // Ignore missing files, no need to check if they are empty.
    // This can happen on sync if the file got deleted.
    if (err.code === 'ENOENT') {
      return false;
    }
  }

  return isEmpty;
};

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
  // In modules/* accept only files from public and private folders, reject rest
  if (filePath.startsWith('modules')) {
    // Ignore template values, explicit test, would work without it
    const reTemplate = win ? new RegExp(`^modules\\[^\\]+\\${files.templateValues}`) : new RegExp(`^modules/[^/]+/${files.templateValues}`);
    if(reTemplate.test(filePath)) return false;

    // TODO: Use glob to avoid if
    const re = win ? /^modules\\.*\\(public|private)/ : /^modules\/.*\/(public|private)/;
    return re.test(filePath);
  } else {
    return true; // If its not file in modules/, accept
  }
};

const isNotOnIgnoreList = (filePath, ignoreList) => {
  const ig = ignore().add(ignoreList);
  return ig.ignores(filePath) === false;
};

const hasNoInvalidChars = filePath => {
  const valid = isValidFilePath(filePath);

  if (!valid) {
    logger.Warn(`[Sync] Invalid characters in file path: ${filePath}. Not syncing.`);
  }

  return true;
};

module.exports = (filePath, ignoreList) => {
  return (
    isNotOnIgnoreList(filePath, ignoreList) &&
    isValidExtension(filePath) &&
    isNotEmptyYML(filePath) &&
    isValidModuleFile(filePath) &&
    hasNoInvalidChars(filePath)
  );
};
