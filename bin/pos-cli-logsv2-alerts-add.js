#!/usr/bin/env node

const program = require('commander'),
      logger = require('../lib/logger'),
      swagger = require('../lib/swagger-client');

program
  .name('pos-cli logsv2 alerts add')
  .arguments('[environment]', 'name of environment. Example: staging')
  .option('--url <url>', 'post alarms to this url')
  .option('--name <name>', 'alert name')
  .option('--keyword <keyword>', 'alert keyword trigger')
  .option('--operator <operator>', 'operator', "Contains")
  .option('--column <column>', 'column', "message")
  .option('--json', 'output as json')
  .action(async (environment) => {
    // try {
      const client = await swagger.SwaggerProxy.client(environment);

      client
        .createAlert(program)
        .then(response => {
          if (!program.json)
            console.log(response.body)
          else
            console.log(response.body)
        })
        .catch(logger.Error)
    // } catch(e) { logger.Error(e.message) }
  });

program.parse(process.argv);
