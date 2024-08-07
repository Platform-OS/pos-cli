#!/usr/bin/env node

const { program } = require('commander'),
      logger = require('../lib/logger'),
      swagger = require('../lib/swagger-client');

program
  .name('pos-cli logsv2 search')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--stream_name <stream_name>', 'stream name to search around in', 'logs')
  .option('--key <key>', 'key, timestamp you want to search logs around, eg: 1701428187696722')
  .option('--size <size>', 'rows size', 10)
  .option('--json', 'output as json')
  .action(async (environment, params) => {
    try {
      const client = await swagger.SwaggerProxy.client(environment);
      const response = await client.searchAround(params)

      if (!params.json)
        swagger.search.printLogs(response, params.key)
      else
        console.log(response)

    } catch(e) {
      logger.Error(e);
    }
  });

program.parse(process.argv);
