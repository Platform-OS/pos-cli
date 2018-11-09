#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'name of the environment. Example: staging')
  .arguments('<timestamp>', 'timestamp the migration. Example: 20180701182602')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, timestamp, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const gateway = new Gateway(authData);
    const formData = { timestamp: timestamp };

    gateway.runMigration(formData).then(body => {
      logger.Success(`[Migration Run] Done. ${body['name']} executed.`);
    });
  });

program.parse(process.argv);

if (!program.args.length) program.help();
