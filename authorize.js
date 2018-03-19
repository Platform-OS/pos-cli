const fs = require('fs');

const settingsFileName = '.marketplace-kit';
const existingSettings = () => {
  if (fs.existsSync(settingsFileName)) {
    return JSON.parse(fs.readFileSync(settingsFileName));
  } else {
    return {};
  }
};

const loadSettingsToEnv = (endpoint) => {
  const settings = existingSettings()[endpoint];
  if (settings) {
    process.env.MARKETPLACE_API_KEY = settings.token;
    process.env.MARKETPLACE_URL = settings.url;
  } else {
    console.log(`No settings for ${endpoint} endpoint, please add remote`);
    process.exit(1);
  }
};

module.exports = loadSettingsToEnv;
