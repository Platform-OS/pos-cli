#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';

const logMigration = migration => {
  const errorsMsg = migration.error_messages ? `- Errors: (${migration.error_messages})` : '';
  logger.Info(`[${migration.id}] Name: ${migration.name} - Status: ${migration.state} ${errorsMsg}`);
};

program
  .name('pos-cli migrations list')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(async environment => {
    const authData = await fetchSettings(environment, program);
    const gateway = new Gateway(authData);

    gateway.listMigrations().then(response => response.migrations.map(logMigration));
  });

program.parse(process.argv);
