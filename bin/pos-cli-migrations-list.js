#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings;

const logMigration = migration => {
  const errorsMsg = migration.error_messages ? `- Errors: (${migration.error_messages})` : '';
  logger.Info(`[${migration.id}] Name: ${migration.name} - Status: ${migration.state} ${errorsMsg}`);
};

program
  .name('pos-cli migrations list')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(environment => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    gateway.listMigrations().then(response => response.migrations.map(logMigration));
  });

program.parse(process.argv);
