import fs from 'fs';

import logger from './logger.js';
import files from './files.js';
import dir from './directories.js';
import { moduleConfigFileName } from './modules.js';

const loadSettingsFileForModule = module => {
  const templatePath = `${dir.MODULES}/${module}/${moduleConfigFileName}`;
  if (fs.existsSync(templatePath)) {
    return files.readJSON(templatePath, { exit: false });
  } else {
    return {};
  }
};

const fetchSettings = async (environment) => {
  const settings = settingsFromEnv() || settingsFromDotPos(environment);
  if (settings) return settings;

  if (environment) {
    await logger.Error(`No settings for ${environment} environment, please see pos-cli env add`);
  } else {
    await logger.Error('No environment specified, please pass environment for a command `pos-cli <command> [environment]`');
  }

  // Ensure process exits (logger.Error should exit, but this is a safeguard)
  process.exit(1);
};

const settingsFromEnv = () => {
  const { MPKIT_URL: url, MPKIT_EMAIL: email, MPKIT_TOKEN: token } = process.env;
  if (url && token && email) {
    return { url, email, token };
  }
};

const settingsFromDotPos = (env) => files.getConfig()[env];

export { fetchSettings, loadSettingsFileForModule, settingsFromDotPos };
