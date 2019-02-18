const fs = require('fs'),
  logger = require('./logger');

const loadSettingsFile = path => {
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path));
  } else {
    return {};
  }
};

const existingSettings = () => {
  return loadSettingsFile(process.env.CONFIG_FILE_PATH);
};

const fetchSettings = environment => {
  const settings = settingsFromEnv() || existingSettings()[environment];
  if (settings) {
    return settings;
  } else {
    logger.Error(`No settings for ${environment} environment, please see marketplace-kit env add`);
  }
};

const settingsFromEnv = () => {
  const env = process.env;
  if (env.MPKIT_URL && env.MPKIT_TOKEN && env.MPKIT_EMAIL){
    return { url: env.MPKIT_URL, email: env.MPKIT_EMAIL, token: env.MPKIT_TOKEN };
  }
};

const listEnvironments = () => {
  const settings = Object(existingSettings());
  const list = Object.keys(settings);

  if (list.length) {
    return list.map(key => `${key} \t${settings[key].url}`);
  } else {
    logger.Error('No environments registered yet, please see marketplace-kit env add');
  }
};

module.exports = { fetchSettings, listEnvironments, loadSettingsFile };
