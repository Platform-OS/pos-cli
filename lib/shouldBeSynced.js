import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import normalize from 'normalize-path';

import watchFilesExtensions from './watch-files-extensions.js';
import logger from './logger.js';
import isValidFilePath from './utils/valid-file-path.js';
import { moduleConfigFileName } from './modules.js';

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
  // Normalize to forward slashes for consistent pattern matching across platforms
  const normalizedPath = normalize(filePath);

  if (normalizedPath.startsWith('modules')) {
    const reTemplate = new RegExp(`^modules/[^/]+/${moduleConfigFileName}`);
    if(reTemplate.test(normalizedPath)) return false;

    const re = /^modules\/.*\/(public|private)/;
    return re.test(normalizedPath);
  } else {
    return true;
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

const shouldBeSynced = (filePath, ignoreList) => {
  return (
    isNotOnIgnoreList(filePath, ignoreList) &&
    isValidExtension(filePath) &&
    isNotEmptyYML(filePath) &&
    isValidModuleFile(filePath) &&
    hasNoInvalidChars(filePath)
  );
};

export default shouldBeSynced;
