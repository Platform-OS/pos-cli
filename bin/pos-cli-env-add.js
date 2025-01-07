#!/usr/bin/env node

const { program } = require('commander');
const ServerError = require('../lib//ServerError');
const logger = require('../lib/logger');
const addEnv = require('../lib/env-add/main')

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
        ServerError.handler(e)
      else
        logger.Error(e);
    }
    process.exit(1);
  });

program.parse(process.argv);
