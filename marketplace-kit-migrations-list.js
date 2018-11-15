#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

const logMigration = migration => {
  const errorsMsg = migration.error_messages ? `- Errors: (${migration.error_messages})` : '';
  logger.Info(`[${migration.id}] Name: ${migration.name} - Status: ${migration.state} ${errorsMsg}`);
};

program
  .version(version)
  .arguments('<environment>', 'name of the environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const gateway = new Gateway(authData);

    gateway.listMigrations().then(response => response.migrations.reverse().map(logMigration));
  });

program.parse(process.argv);

if (!program.args.length) program.help();
