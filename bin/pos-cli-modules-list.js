#!/usr/bin/env node

import { program } from '../lib/program.js';

import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';

program
  .name('pos-cli modules list')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(async environment => {
    const authData = await fetchSettings(environment, program);
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
