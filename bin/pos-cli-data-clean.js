#!/usr/bin/env node

const { program } = require('commander'),
  prompts = require('prompts'),
  Gateway = require('../lib/proxy'),
  waitForStatus = require('../lib/data/waitForStatus'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  logger = require('../lib/logger'),
  ServerError = require('../lib/ServerError');

// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

const confirmationText = 'CLEAN DATA';

const confirmCleanup = async (autoConfirm, includeSchema, url) => {
  if (autoConfirm) return true;
  try {
    let schemaText = includeSchema ? 'and database schemas ' : '';

    logger.Warn('');
    logger.Warn(`WARNING!!! You are going to REMOVE your data ${schemaText}from instance: ${url}`);
    logger.Warn('There is no coming back.');
    logger.Warn('');

    const message = `If you still want to continue please type: '${confirmationText}' `;
    const response = await prompts({ type: 'text', name: 'confirmation', message: message });

    return response.confirmation == confirmationText;
  }
  catch(e) {
    logger.Error(e)
    return false;
  }
};

program
  .name('pos-cli data clean')
  .argument('[environment]', 'name of the environment. Example: staging')
  .option('--auto-confirm', 'auto confirm instance clean without prompt')
  .option('-i, --include-schema', 'also remove instance files: pages, schemas etc.')
  .action(async (environment, params) => {

    await initializeEsmModules();
    const spinner = ora({ text: 'Sending data', stream: process.stdout });
    
    try {
      const gateway = new Gateway(fetchAuthData(environment));
      const confirmed = await confirmCleanup(params.autoConfirm, params.includeSchema, gateway.url)
      if (confirmed) {
        spinner.start(`Cleaning instance`);

        const response = await gateway.dataClean(confirmationText, params.includeSchema)
        logger.Debug(`Cleanup request id: ${response}`);

        const checkDataCleanJobStatus = () => { return gateway.dataCleanStatus(response.id) }
        await waitForStatus(checkDataCleanJobStatus, 'pending', 'done')

        spinner.stopAndPersist().succeed('DONE. Instance cleaned');
      }
      else logger.Error('Wrong confirmation. Closed without cleaning instance data.');

    }
    catch(e) {
      spinner.fail(`Instance cleanup has failed.`);
      console.log(e.name);

      // custom handle 422
      if (e.statusCode == 422)
        logger.Error('[422] Data clean is either not supported by the server or has been disabled.');
      else if (ServerError.isNetworkError(e))
        ServerError.handler(e)
      else
        logger.Error(e)
    }
  });

program.parse(process.argv);
