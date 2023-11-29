#!/usr/bin/env node

const program = require('commander'),
      logger = require('../lib/logger'),
      swagger = require('../lib/swagger-client');

program
  .name('pos-cli logsv2 alerts list')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--json', 'output as json')
  .action(async (environment) => {
    try {
      const client = await swagger.SwaggerProxy.client(environment);
      const response = await client.alerts(program)

      if (!program.json)
        console.log(response)
      else
        console.log(response)
    }
    catch(e) { logger.Error(e) }
  })

program.parse(process.argv);
