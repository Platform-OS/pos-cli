const fs = require('fs');

const filename = '.marketplace-kit';
const existingSettings = () => {
  if (fs.existsSync(filename)) {
    return JSON.parse(fs.readFileSync(filename));
  } else {
    return {};
  }
};

const fetchSettings = (endpoint) => {
  const settings = existingSettings()[endpoint];
  if (settings) {
    return settings;
  } else {
    console.log(`No settings for ${endpoint} endpoint, please see marketplace-kit remote add`);
    process.exit(1);
  }
};

module.exports = fetchSettings;
