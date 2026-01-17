#!/usr/bin/env node

import { program } from 'commander';
import logger from '../lib/logger.js';
import { SwaggerProxy } from '../lib/swagger-client.js';

program
  .name('pos-cli logsv2 alerts trigger')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--name <name>', 'alert name')
  .option('--json', 'output as json')
  .action(async (environment, params) => {
    try {
      const client = await SwaggerProxy.client(environment);
      const response = await client.triggerAlert(params)

      if (!params.json)
        console.log(response)
      else
        console.log(response)

    } catch(e) { logger.Error(e) }
  });

program.parse(process.argv);
