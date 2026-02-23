#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { SwaggerProxy } from '../lib/swagger-client.js';

program
  .name('pos-cli logsv2 alerts list')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--json', 'output as json')
  .action(async (environment) => {
    try {
      const client = await SwaggerProxy.client(environment);
      const response = await client.alerts(program);

      if (!program.json)
        console.log(response);
      else
        console.log(response);
    } catch(e) {
      logger.Error(e); 
    }
  });

program.parse(process.argv);
