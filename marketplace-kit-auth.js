#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

const checkParams = params => {
  if (!params.args.length) {
    params.help();
    process.exit(1);
  }
};

const settingsFileName = '.marketplace-kit';
const existingSettings = () => {
  if (fs.existsSync(settingsFileName)) {
    return JSON.parse(fs.readFileSync(settingsFileName));
  } else {
    return {};
  }
};

const loadSettingsToEnv = environment => {
  const settings = existingSettings()[environment];

  if (settings) {
    process.env['MARKETPLACE_TOKEN'] = settings.token;
    process.env['MARKETPLACE_URL'] = settings.url;
  } else {
    logger.Warn(`No settings for ${environment} environment, please see marketplace-kit env add`);
    process.exit(1);
  }
};

program
  .version(version)
  .arguments('<environment>', 'name of environment. Example: staging')
  .action((environment, params) => {
    checkParams(params);
    loadSettingsToEnv(environment);
    console.log(process.env.MARKETPLACE_URL);
  });

program.parse(process.argv);
