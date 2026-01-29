#!/usr/bin/env node

import { program } from 'commander';
import logger from '../lib/logger.js';
import { SwaggerProxy } from '../lib/swagger-client.js';

program
  .name('pos-cli logsv2 alerts add')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--url <url>', 'post alarms to this url')
  .option('--name <name>', 'alert name')
  .option('--keyword <keyword>', 'alert keyword trigger')
  .option('--operator <operator>', 'operator', 'Contains')
  .option('--column <column>', 'column', 'message')
  .option('--channel <channel>')
  .option('--json', 'output as json')
  .action(async (environment, params) => {
    try {
      if (!params.channel) {
        throw Error('--channel is required');
      }

      const client = await SwaggerProxy.client(environment);
      const response = await client.createAlert(params);

      if (!params.json)
        console.log(response);
      else
        console.log(response);

    } catch(e) {
      logger.Error(e); 
    }
  });

program.parse(process.argv);
