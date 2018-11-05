#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/kit').logger,
  fetchAuthData = require('./lib/settings').fetchSettings,
  version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'name of the environment. Example: staging')
  .option(
    '-c --config-file <config-file>',
    'config file path',
    '.marketplace-kit'
  )
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const gateway = new Gateway(authData);

    gateway.listMigrations().then(
      body => {
        logger.Success(`[Migration - List]`);
        body['migrations'].map(migration => {
          logger.Info(
            `${migration['name']} - ${migration['state']} Errors: (${migration['error_messages']})`
          );
        });
      },
      error => {
        logger.Error(`[Migration - List] Error ${error.message}`);
      }
    );
  });

program.parse(process.argv);

if (!program.args.length) program.help();
