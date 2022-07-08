#!/usr/bin/env node

const program = require('commander'),
  prompts = require('prompts'),
  ora = require('ora'),
  Gateway = require('../lib/proxy'),
  waitForStatus = require('../lib/data/waitForStatus'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  logger = require('../lib/logger'),
  report = require('../lib/logger/report');

const confirmationText = 'CLEAN DATA';
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });

const clean = (gateway, includeSchema) => {
  logger.Info('Going to clean data');
  gateway
    .dataClean(confirmationText, includeSchema)
    .then((cleanTask) => {
      spinner.stopAndPersist().succeed('Clean started').start(`Cleaning instance`);
      waitForStatus(() => gateway.dataCleanStatus(cleanTask.id))
        .then(() => {
          spinner.stopAndPersist().succeed('Cleaning done');
        })
        .catch((error) => {
          logger.Debug(error);
          spinner.fail('Data clean failed');
          logger.Error(`Unable to clean instance ${error.error}`);
        });
    })
    .catch({ statusCode: 404 }, () => {
      logger.Error('[404] Data clean is not supported by the server');
      report('[Err] Data: Clean - Not supported');
    });
};

const promptConfirmation = async confirmationText => {
  const message = `If you still want to continue please type: '${confirmationText}' `;

  const response = await prompts({ type: 'text', name: 'confirmation', message: message });
  return response.confirmation;
};

const confirmCleanup = async (gateway, inlineConfirmation, includeSchema) => {
  let schemaText = includeSchema ? 'and database schemas ' : '';

  logger.Warn('');
  logger.Warn(`WARNING!!! You are going to REMOVE your data ${schemaText}from instance: ${gateway.url}`);
  logger.Warn('There is no coming back.');
  logger.Warn('');
  const confirmed = inlineConfirmation || (await promptConfirmation(confirmationText)) == confirmationText;
  if (confirmed) {
    clean(gateway, includeSchema);

    report('[OK] Data: Clean');
  } else {
    logger.Error('Wrong confirmation. Closed without cleaning instance data.');
    report('[ERR] Data: Clean - Wrong confirmation');
  }
};

program
  .name('pos-cli data clean')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('--auto-confirm', 'auto confirm instance clean without prompt')
  .option('-i, --include-schema', 'also remove instance files: pages, schemas etc.')
  .action((environment, params) => {
    const gateway = new Gateway(fetchAuthData(environment, program));

    confirmCleanup(gateway, params.autoConfirm, params.includeSchema);
  });

program.parse(process.argv);
