#!/usr/bin/env node

const fs = require('fs');

const program = require('commander'),
  shell = require('shelljs');

const Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  dir = require('../lib/directories');

program
  .name('pos-cli migrations generate')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'base name of the migration. Example: cleanup_data')
  .action((environment, name) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    const formData = { name: name };

    const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;
    const migrationsDir = `${appDirectory}/migrations`;

    gateway.generateMigration(formData).then(body => {
      const path = `${migrationsDir}/${body['name']}.liquid`;
      shell.mkdir('-p', migrationsDir);

      fs.writeFileSync(path, body['body'], logger.Error);

      report('Migrations run');
      logger.Success(`[Migration Generate] Saved to: ${path}`);
    });
  });

program.parse(process.argv);
