#!/usr/bin/env node

const program = require('commander'),
  prompts = require('prompts'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings;

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

const confirmationText = 'CLEAN DATA';

const clean = (gateway, includeSchema) => {
  logger.Info('Going to clean data');
  gateway
    .dataClean(confirmationText, includeSchema)
    .then(() => logger.Success('Instance data scheduled to be clean.'))
    .catch({ statusCode: 404 }, () => logger.Error('[404] Data clean is not supported by the server'));
};

const promptConfirmation = async confirmationText => {
  const message = `If you still want to continue please type: '${confirmationText}' `;

  const response = await prompts({ type: 'text', name: 'confirmation', message: message });
  return response.confirmation;
};

const confirmCleanup = async (gateway, inlineConfirmation, includeSchema) => {
  let schemaText = '';
  if (includeSchema) {
    schemaText = 'and database schemas '
  }

  logger.Warn('');
  logger.Warn(`WARNING!!! You are going to REMOVE your data ${schemaText}from instance: ${gateway.url}`);
  logger.Warn('There is no coming back.');
  logger.Warn('');
  const confirmed = inlineConfirmation || (await promptConfirmation(confirmationText)) == confirmationText;
  if (confirmed) {
    clean(gateway, includeSchema);

    report('Data: Clean', {
      extras: [
        { key: 'status', value: 'Success' },
        { key: 'url', value: gateway.url }
      ],
    });
  } else {
    logger.Error('Wrong confirmation. Closed without cleaning instance data.');
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
