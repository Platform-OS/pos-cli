const fs = require('fs'),
  logger = require('./logger'),
  dir = require('./directories');

const loadSettingsFile = path => {
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path));
  } else {
    return {};
  }
};

const loadSettingsFileForModule = module => loadSettingsFile(`${dir.MODULES}/${module}/template-values.json`);
const existingSettings = () => loadSettingsFile(process.env.CONFIG_FILE_PATH);

// TODO: Get rid off program. Just return false in here and show help wherever it was executed.
const fetchSettings = (environment, program) => {
  const settings = settingsFromEnv() || existingSettings()[environment];
  if (settings) return settings;

  if (environment) {
    logger.Warn(`No settings for ${environment} environment, please see pos-cli env add`);
  } else {
    logger.Warn('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  }
  program.help();
};

// TODO: Destructure
const settingsFromEnv = () => {
  const env = process.env;
  if (env.MPKIT_URL && env.MPKIT_TOKEN && env.MPKIT_EMAIL) {
    return { url: env.MPKIT_URL, email: env.MPKIT_EMAIL, token: env.MPKIT_TOKEN };
  }
};

const listEnvironments = () => {
  const settings = Object(existingSettings());
  const list = Object.keys(settings);

  if (list.length) {
    return list.map(key => `${key} \t${settings[key].url}`);
  } else {
    logger.Error('No environments registered yet, please see pos-cli env add');
  }
};

module.exports = { fetchSettings, listEnvironments, loadSettingsFile, loadSettingsFileForModule };
