#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';

program
  .name('pos-cli modules remove')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'name of the module. Example: admin_cms')
  .action(async (environment, name) => {
    const authData = await fetchSettings(environment, program);
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
