#!/usr/bin/env node

const { program } = require('commander'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings;

program
  .name('pos-cli migrations run')
  .arguments('<timestamp>', 'timestamp the migration. Example: 20180701182602')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action((timestamp, environment) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const formData = { timestamp: timestamp };

    gateway.runMigration(formData).then(body => {
      logger.Success(`[Migration Run] Done. ${body['name']} executed.`);
    });
  });

program.parse(process.argv);

if (!program.args.length) {
  program.outputHelp();
  process.exit(1);
}
