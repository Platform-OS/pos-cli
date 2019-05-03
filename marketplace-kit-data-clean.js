#!/usr/bin/env node

const program = require('commander'),
  prompts = require('prompts'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;
const confirmationText = 'CLEAN DATA';

const clean = (gateway, confirmation) => {
  logger.Info('Going to clean data');
  gateway
    .dataClean(confirmationText)
    .then(() => logger.Success('Instance data cleaned.'))
    .catch({ statusCode: 404 }, () => logger.Error('[404] Data clean is not supported by the server'));
};

const promptConfirmation = async(confirmationText) => {
  const message = `If you still want to continue please type: '${confirmationText}' `;

  const response = await prompts({ type: 'text', name: 'confirmation', message: message });
  return response.confirmation;
};

const confirmCleanup = async(gateway, inlineConfirmation) => {
  logger.Warn('');
  logger.Warn(`WARNING!!! You are going to REMOVE your data from instance: ${gateway.url}`);
  logger.Warn('There is no comming back.');
  logger.Warn('');
  const confirmed = inlineConfirmation || (await promptConfirmation(confirmationText)) == confirmationText;
  if (confirmed) {
    clean(gateway);
  } else {
    logger.Error('Wrong confirmation. Closed without cleaning instance data.');
    process.exit(1);
  }
};

program
  .version(version)
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('--auto-confirm', 'auto confirm instance clean without prompt')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const gateway = new Gateway(fetchAuthData(environment, program));

    confirmCleanup(gateway, params.autoConfirm);
  });

program.parse(process.argv);
