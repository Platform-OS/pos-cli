const fs = require('fs');

const existingSettings = () => {
  if (fs.existsSync(process.env.CONFIG_FILE_PATH)) {
    return JSON.parse(fs.readFileSync(process.env.CONFIG_FILE_PATH));
  } else {
    return {};
  }
};

const fetchSettings = (endpoint) => {
  const settings = existingSettings()[endpoint];
  if (settings) {
    return settings;
  } else {
    console.log(`No settings for ${endpoint} endpoint, please see marketplace-kit env add`);
    process.exit(1);
  }
};

const listEnvironments= () => {
  const list = Object.keys(existingSettings());
  if (list.length) {
    return list;
  } else {
    console.log('No environments registered yet, please see marketplace-kit env add');
    process.exit(1);
  }
};

module.exports = { fetchSettings, listEnvironments };
