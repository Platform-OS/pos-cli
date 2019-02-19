#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    gateway.listModules().then(response => {
      if (response.data.length === 0) {
        logger.Info('There are no installed modules');
      } else {
        logger.Info('Installed modules:');
        response.data.map(logger.Info);
      }
    });
  });

program.parse(process.argv);
