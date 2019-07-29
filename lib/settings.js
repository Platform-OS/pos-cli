const fs = require('fs');

const logger = require('./logger'),
  files = require('./files'),
  dir = require('./directories');

const loadSettingsFileForModule = module => {
  const templatePath = `${dir.MODULES}/${module}/template-values.json`;
  if (fs.existsSync(templatePath)) {
    return files.readJSON(templatePath, { exit: false });
  } else {
    return {};
  }
};

// TODO: Get rid off program. Just return false in here and show help wherever it was executed.
const fetchSettings = (environment, program) => {
  const settings = settingsFromEnv() || files.getConfig()[environment];
  if (settings) return settings;

  if (environment) {
    logger.Warn(`No settings for ${environment} environment, please see pos-cli env add`);
  } else {
    logger.Warn('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  }
  program.help();
};

const settingsFromEnv = () => {
  const { MPKIT_URL: url, MPKIT_EMAIL: email, MPKIT_TOKEN: token } = process.env;
  if (url && token && email) {
    return { url, email, token };
  }
};

const listEnvironments = () => {
  const settings = Object(files.getConfig());
  const list = Object.keys(settings);

  if (list.length) {
    return list.map(key => `${key} \t${settings[key].url}`);
  } else {
    logger.Error('No environments registered yet, please see pos-cli env add');
  }
};

module.exports = { fetchSettings, listEnvironments, loadSettingsFileForModule };
