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
    return settings;
  } else {
    console.log(`No settings for ${endpoint} endpoint, please see marketplace-kit remote add`);
    process.exit(1);
  }
};

module.exports = loadSettingsToEnv;
