const fs = require('fs');

const logger = require('./logger');
const files = require('./files');
const dir = require('./directories');
const { moduleConfigFileName } = require('./modules');

const loadSettingsFileForModule = module => {
  const templatePath = `${dir.MODULES}/${module}/${moduleConfigFileName}`;
  if (fs.existsSync(templatePath)) {
    return files.readJSON(templatePath, { exit: false });
  } else {
    return {};
  }
};

const fetchSettings = (environment) => {
  const settings = settingsFromEnv() || files.getConfig()[environment];
  if (settings) return settings;

  if (environment) {
    logger.Error(`No settings for ${environment} environment, please see pos-cli env add`);
  } else {
    logger.Error('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  }
};

const settingsFromEnv = () => {
  const { MPKIT_URL: url, MPKIT_EMAIL: email, MPKIT_TOKEN: token } = process.env;
  if (url && token && email) {
    return { url, email, token };
  }
};

module.exports = { fetchSettings, loadSettingsFileForModule, settingsFromEnv };
