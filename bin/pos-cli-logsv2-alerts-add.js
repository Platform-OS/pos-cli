#!/usr/bin/env node

const { program } = require('commander'),
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
  .option('--channel <channel>')
  .option('--json', 'output as json')
  .action(async (environment, params) => {
    try {
      if (!params.channel) {
        throw Error("--channel is required")
      }

      const client = await swagger.SwaggerProxy.client(environment);
      const response = await client.createAlert(params)

      if (!params.json)
        console.log(response)
      else
        console.log(response)

    } catch(e) { logger.Error(e) }
  });

program.parse(process.argv);
