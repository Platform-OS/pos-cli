#!/usr/bin/env node

const program = require('commander'),
      Gateway = require('./lib/proxy'),
      fs = require('fs'),
      logger = require('./lib/kit').logger,
      fetchAuthData = require('./lib/settings').fetchSettings,
      version = require('./package.json').version;

program
  .version(version)
  .arguments('<environment>', 'name of the environment. Example: staging')
  .arguments('<name>', 'base name of the migration. Example: cleanup_data')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, name, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    const gateway = new Gateway(authData);
    const formData = { 'name': name};
    const migrationsDir = 'marketplace_builder/migrations';

    gateway.generateMigration(formData).then(
      body => {
        logger.Success('[GenerateMigration] generated ${body["name"]}');
        path = `${migrationsDir}/${body["name"]}.liquid`;

        if (!fs.existsSync(migrationsDir)) {
          fs.mkdirSync(migrationsDir);
        }
        fs.writeFileSync(path, body["body"], logger.Error);
      },
      error => {
        logger.Error(`[GenerateMigration] ${error}`);
      }
    );
  });

program.parse(process.argv);
