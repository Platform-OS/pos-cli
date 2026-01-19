import path from 'path';
import fs from 'fs';
import glob from 'fast-glob';

import logger from './logger.js';
import dir from './directories.js';

const config = {
  CONFIG: '.pos',
  LEGACY_CONFIG: '.marketplace-kit',
  IGNORE_LIST: '.posignore'
};

const _paths = customConfig => [customConfig, config.CONFIG, config.LEGACY_CONFIG];

const _getConfigPath = customConfig => {
  const firstExistingConfig = _paths(customConfig).filter(path => path && fs.existsSync(path))[0];
  logger.Debug(`[_getConfigPath] First existing config file: ${firstExistingConfig}`);
  return path.resolve(firstExistingConfig || config.CONFIG);
};

const _readJSON = (filePath, opts = { exit: true, throwDoesNotExistError: false }) => {
  if (fs.existsSync(filePath)) {
    logger.Debug(`[_readJSON] File exist: ${filePath}.`);

    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });

    try {
      return JSON.parse(fileContent);
    } catch (error) {
      logger.Debug(`${error.message}`);
      logger.Error(`${filePath} is not a valid JSON file. Use https://jsonlint.com to lint your JSON syntax.`, {
        exit: false
      });
      logger.Error(`Error thrown by the parser: ${error.message}`, { exit: opts.exit });
    }
  } else {
    if (opts.throwDoesNotExistError) {
      logger.Error(`File doesn't exist: ${filePath}`, { exit: opts.exit });
    } else {
      logger.Debug(`[_readJSON] File doesn't exist: ${filePath}`);
    }
    return {};
  }
};

const _writeJSON = (filePath, content, opts = { exit: true, replacer: null, space: 2}) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(content, opts.replacer, opts.space));
  } catch (error) {
    logger.Debug(`${error.message}`);
    logger.Error(`Error thrown when writing a json to ${filePath}: ${error.message}`, { exit: opts.exit });
  }
};

const _readIgnoreList = filePath => {
  if (fs.existsSync(filePath) === false) {
    return [];
  }

  const rules = fs
    .readFileSync(filePath, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter(line => line.indexOf('#') !== 0);

  return rules;
};

const _getAssets = async () => {
  const appAssets = fs.existsSync(`${dir.currentApp()}/assets`) ? await glob(`${dir.currentApp()}/assets/**`) : [];
  const modulesAssets = fs.existsSync(dir.MODULES) ? await glob('modules/*/{private,public}/assets/**') : [];

  return [...appAssets, ...modulesAssets];
};

const methods = {
  readJSON: _readJSON,
  writeJSON: _writeJSON,
  getConfigPath: _getConfigPath,
  getConfig: () => {
    const configPath = _getConfigPath(process.env.CONFIG_FILE_PATH);
    logger.Debug(`[getConfig] Looking for config in: ${configPath}`);
    return _readJSON(configPath) || {};
  },
  getAssets: _getAssets,
  getIgnoreList: ignoreListPath => _readIgnoreList(ignoreListPath || config.IGNORE_LIST) || []
};

export default Object.assign({}, config, methods);
