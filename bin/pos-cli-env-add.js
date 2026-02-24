#!/usr/bin/env node

import { program } from '../lib/program.js';
import ServerError from '../lib/ServerError.js';
import logger from '../lib/logger.js';
import addEnv from '../lib/envs/add.js';

program.showHelpAfterError();
program
  .name('pos-cli env add')
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('--email <email>', 'Partner Portal account email. Example: admin@example.com')
  .requiredOption('--url <url>', 'marketplace url. Example: https://example.com')
  .option('--partner-portal-url <partnerPortalUrl>', 'Partner Partner URL', 'https://partners.platformos.com')
  .option(
    '--token <token>',
    'if you have a token you can add it directly to pos-cli configuration without connecting to portal'
  )
  .action(async (environment, params) => {
    try {
      await addEnv(environment, params);
    } catch (e) {
      if (ServerError.isNetworkError(e))
        await ServerError.handler(e);
      else
        await logger.Error(e);
    }
  });

program.parse(process.argv);
