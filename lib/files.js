const path = require('path');
const fs = require('fs');

const logger = require('./logger');

const config = {
  CONFIG: '.pos',
  LEGACY_CONFIG: '.marketplace-kit'
};

const _paths = customConfig => [customConfig, config.CONFIG, config.LEGACY_CONFIG];

const _getConfigPath = customConfig => {
  const firstExistingConfig = _paths(customConfig).filter(fs.existsSync)[0];
  logger.Debug(`[_getConfigPath] First existing config file: ${firstExistingConfig}`);
  return path.resolve(firstExistingConfig || config.CONFIG);
};

const _readJSON = filePath => {
  if (fs.existsSync(filePath)) {
    logger.Debug(`[_readJSON] Found file at ${filePath}`);

    var absPath = path.resolve(filePath);
    return JSON.parse(fs.readFileSync(absPath, { encoding: 'utf8' }));
  } else {
    logger.Debug(`[_readJSON] Invalid JSON file at ${absPath}`);
    return {};
  }
};

const methods = {
  readJSON: _readJSON,
  getConfigPath: _getConfigPath,
  getConfig: () => {
    const configPath = _getConfigPath(process.env.CONFIG_FILE_PATH);
    logger.Debug(`[getConfig] Looking for config in: ${configPath}`);
    return _readJSON(configPath);
  }
};

module.exports = Object.assign({}, config, methods);
