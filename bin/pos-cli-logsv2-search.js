#!/usr/bin/env node

const { program } = require('commander'),
      logger = require('../lib/logger'),
      swagger = require('../lib/swagger-client');
const ServerError = require('../lib/ServerError');

program
  .name('pos-cli logsv2 search')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--sql <sql>', 'SQL query to fetch logs')
  .option('--size <size>', 'rows size', 10)
  .option('--from <from>', 'start from', 0)
  .option('--start_time <st>', 'starttime')
  .option('--end_time <et>', 'endtime')
  .option('--json', 'output as json')
  .action(async (environment, program) => {
    try {
      const client = await swagger.SwaggerProxy.client(environment);
      const response = await client.searchSQL(program)

      if (!program.json)
        swagger.search.printLogs(response)
      else
        console.log(response)

    } catch(e) {
      logger.Error(e);
    }
  });

program.parse(process.argv);
