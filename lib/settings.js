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
    logger.Info(`No settings for ${environment} environment, please see marketplace-kit env add`);
    process.exit(1);
  }
};

const listEnvironments = () => {
  const settings = Object(existingSettings());
  const list = Object.keys(settings);

  if (list.length) {
    return list.map(key => `${key} \t${settings[key].url}`);
  } else {
    logger.Info('No environments registered yet, please see marketplace-kit env add');
    process.exit(1);
  }
};

module.exports = { fetchSettings, listEnvironments };
