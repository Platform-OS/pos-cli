#!/usr/bin/env node

const program = require('commander'),
  prompts = require('prompts'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

const clean = (gateway, confirmation) => {
  logger.Info('Going to clean data');
  gateway
    .dataClean(confirmation)
    .then(() => logger.Success('Instance data cleaned.'))
    .catch({ statusCode: 404 }, () => logger.Error('[404] Data clean is not supported by the server'));
};

async function confirmCleanup(gateway) {
  const confirmationText = 'CLEAN DATA';
  const message = `WARNING!!! You are going to REMOVE your data.
There is no comming back.
If you still want to continue please type: '${confirmationText}' `;

  const response = await prompts({ type: 'text', name: 'confirmation', message: message });
  if (response.confirmation == confirmationText) {
    clean(gateway, response.confirmation);
  } else {
    logger.Info('Closed without cleaning instance data.');
  }
}

program
  .version(version)
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const gateway = new Gateway(fetchAuthData(environment, program));

    confirmCleanup(gateway);
  });

program.parse(process.argv);
