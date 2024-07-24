#!/usr/bin/env node

const { program } = require('commander');

const Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings;

program
  .name('pos-cli modules list')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(environment => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    gateway.listModules().then(response => {
      if (!response.data || response.data.length === 0) {
        logger.Info('There are no installed modules');
      } else {
        logger.Info('Installed modules:');
        response.data.map(module => {
          logger.Info(`\t- ${module}`, { hideTimestamp: true });
        });
      }
    }).catch(logger.Debug);
  });

program.parse(process.argv);
