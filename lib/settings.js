const fs = require('fs'),
  logger = require('./kit').logger;

const existingSettings = () => {
  if (fs.existsSync(process.env.CONFIG_FILE_PATH)) {
    return JSON.parse(fs.readFileSync(process.env.CONFIG_FILE_PATH));
  } else {
    return {};
  }
};

const fetchSettings = environment => {
  const settings = existingSettings()[environment];
  if (settings) {
    return settings;
  } else {
    logger.Error(`No settings for ${environment} environment, please see marketplace-kit env add`);
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

module.exports = { fetchSettings, listEnvironments };
