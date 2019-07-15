#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('../lib/proxy'),
  fs = require('fs'),
  shell = require('@platform-os/shelljs'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  dir = require('../lib/directories');

program
  .name('pos-cli migrations generate')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'base name of the migration. Example: cleanup_data')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, name, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const formData = { name: name };

    const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;
    const migrationsDir = `${appDirectory}/migrations`;

    gateway.generateMigration(formData).then(body => {
      const path = `${migrationsDir}/${body['name']}.liquid`;
      shell.mkdir('-p', migrationsDir);

      fs.writeFileSync(path, body['body'], logger.Error);

      logger.Success(`[Migration Generate] Saved to: ${path}`);
    });
  });

program.parse(process.argv);
