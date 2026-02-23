#!/usr/bin/env node

import { program } from '../lib/program.js';
import prompts from 'prompts';
import Gateway from '../lib/proxy.js';
import waitForStatus from '../lib/data/waitForStatus.js';
import { fetchSettings } from '../lib/settings.js';
import logger from '../lib/logger.js';
import ServerError from '../lib/ServerError.js';
import ora from 'ora';

const confirmationText = process.env.CONFIRMATION_TEXT || 'CLEAN DATA';

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
  } catch(e) {
    logger.Error(e);
    return false;
  }
};

program
  .name('pos-cli data clean')
  .argument('[environment]', 'name of the environment. Example: staging')
  .option('--auto-confirm', 'auto confirm instance clean without prompt')
  .option('-i, --include-schema', 'also remove instance files: pages, schemas etc.')
  .action(async (environment, params) => {

    const spinner = ora({ text: 'Sending data', stream: process.stdout });

    try {
      const gateway = new Gateway(await fetchSettings(environment));
      const confirmed = await confirmCleanup(params.autoConfirm, params.includeSchema, gateway.url);
      if (confirmed) {
        spinner.start('Cleaning instance');

        const response = await gateway.dataClean(confirmationText, params.includeSchema);
        logger.Debug(`Cleanup request id: ${response}`);

        const checkDataCleanJobStatus = () => {
          return gateway.dataCleanStatus(response.id); 
        };
        await waitForStatus(checkDataCleanJobStatus, 'pending', 'done');

        spinner.stopAndPersist().succeed('DONE. Instance cleaned');
      } else logger.Error('Wrong confirmation. Closed without cleaning instance data.');

    } catch(e) {
      spinner.fail('Instance cleanup has failed.');

      // custom handle 422
      if (e.statusCode == 422)
        await logger.Error('[422] Data clean is either not supported by the server or has been disabled.');
      else if (ServerError.isNetworkError(e))
        await ServerError.handler(e);
      else
        await logger.Error(e);
    }
  });

program.parse(process.argv);
