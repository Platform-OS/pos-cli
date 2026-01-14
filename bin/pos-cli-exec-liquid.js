#!/usr/bin/env node

const { program } = require('commander');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');

program
  .name('pos-cli exec liquid')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('<code>', 'liquid code to execute as string')
  .action(async (environment, code) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    try {
      const response = await gateway.liquid({ content: code });

      if (response.error) {
        logger.Error(`Liquid execution error: ${response.error}`);
        process.exit(1);
      }

      if (response.result) {
        logger.Print(response.result);
      }
    } catch (error) {
      logger.Error(`Failed to execute liquid: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);