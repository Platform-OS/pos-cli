const path = require('path');
const fs = require('fs');

const logger = require('./logger');

const config = {
  CONFIG: '.pos',
  LEGACY_CONFIG: '.marketplace-kit',
  templateValues: 'template-values.json'
};

const _paths = customConfig => [customConfig, config.CONFIG, config.LEGACY_CONFIG];

const _getConfigPath = customConfig => {
  const firstExistingConfig = _paths(customConfig).filter(fs.existsSync)[0];
  logger.Debug(`[_getConfigPath] First existing config file: ${firstExistingConfig}`);
  return path.resolve(firstExistingConfig || config.CONFIG);
};

const _readJSON = (filePath, opts = { exit: true }) => {
  if (fs.existsSync(filePath)) {
    logger.Debug(`[_readJSON] File exist: ${filePath}.`);

    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });

    try {
      return JSON.parse(fileContent);
    } catch(error) {
      logger.Debug(`${error.message}`);
      logger.Error(`${filePath} is not a valid JSON file. Use https://jsonlint.com to lint your JSON syntax.`, { exit: false });
      logger.Error(`Error thrown by the parser: ${error.message}`, { exit: opts.exit });
    }
  } else {
    logger.Debug(`[_readJSON] File doesnt exist: ${filePath}`);
    return {};
  }
};

const methods = {
  readJSON: _readJSON,
  getConfigPath: _getConfigPath,
  getConfig: () => {
    const configPath = _getConfigPath(process.env.CONFIG_FILE_PATH);
    logger.Debug(`[getConfig] Looking for config in: ${configPath}`);
    return _readJSON(configPath) || {};
  }
};

module.exports = Object.assign({}, config, methods);
