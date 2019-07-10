const fs = require('fs'),
  path = require('path');

const watchFilesExtensions = require('./watch-files-extensions'),
  logger = require('./logger');

const ext = filePath => filePath.split('.').pop();
const filename = filePath => filePath.split(path.sep).pop();

const isEmpty = filePath =>
  fs
    .readFileSync(filePath)
    .toString()
    .trim().length === 0;

const fileUpdated = event => event === 'update';

const extensionAllowed = filePath => {
  const allowed = watchFilesExtensions.includes(ext(filePath));
  if (!allowed) {
    logger.Debug(`[Sync] Not syncing, not allowed file extension: ${filePath}`);
  }
  return allowed;
};

const isNotHidden = filePath => {
  const isHidden = filename(filePath).startsWith('.');

  if (isHidden) {
    logger.Warn(`[Sync] Not syncing hidden file: ${filePath}`);
  }
  return !isHidden;
};

const isNotEmptyYML = filePath => {
  if (ext(filePath) === 'yml' && isEmpty(filePath)) {
    logger.Warn(`[Sync] Not syncing empty YML file: ${filePath}`);
    return false;
  }

  return true;
};

// Mdule files outside public or private folders are not synced
const isModuleFile = f => {
  let pathArray = f.split(path.sep);
  if ('modules' != pathArray[0]) {
    return true;
  }
  return ['private', 'public'].includes(pathArray[2]);
};

module.exports = (filePath, event) => {
  return (
    fileUpdated(event) &&
    extensionAllowed(filePath) &&
    isNotHidden(filePath) &&
    isNotEmptyYML(filePath) &&
    isModuleFile(filePath)
  );
};
