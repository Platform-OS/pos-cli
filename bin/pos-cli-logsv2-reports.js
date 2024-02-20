#!/usr/bin/env node

const program = require('commander'),
      logger = require('../lib/logger'),
      swagger = require('../lib/swagger-client'),
      path = require('path'),
      fs = require('fs');
const ServerError = require('../lib/ServerError');

program.showHelpAfterError();
program
  .name('pos-cli logsv2 reports')
  .arguments('[environment]', 'name of environment. Example: staging')
  // .option('--from <from>', 'start from', 0)
  // .option('--size <size>', 'rows size', 20)
  // .option('--start_time <st>', 'starttime')
  // .option('--end_time <et>', 'endtime')
  .option('--json', 'output as json')
  .requiredOption('--report <report>', 'available reports: r-4xx, r-slow, r-slow-by-count')
  .action(async (environment, program) => {
    try {
      const client = await swagger.SwaggerProxy.client(environment);

      const report = JSON.parse(fs.readFileSync(path.join(__dirname, `../lib/reports/${program.report}.json`)));
      const response = await client.searchSQLByQuery(report)

      if (!program.json)
        swagger.search.printReport(response, report)
      else
        console.log(JSON.stringify(response))

    } catch(e) {
      logger.Error(e);
    }
  });
program.parse(process.argv);
