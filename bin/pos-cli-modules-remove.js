#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings;

program
  .name('pos-cli modules remove')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'name of the module. Example: admin_cms')
  .action((environment, name) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const formData = { pos_module_name: name };

    gateway
      .removeModule(formData)
      .then(data => {
        logger.Debug(`Removing module, server response: ${data}`);
        logger.Success(`[Module Remove] Successfully removed module ${name}`);
      })
      .catch(error => logger.Error(`Failed to remove the module ${error}`));
  });

program.showHelpAfterError();
program.parse(process.argv);
