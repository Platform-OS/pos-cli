#!/usr/bin/env node

import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';

program
  .name('pos-cli migrations run')
  .arguments('<timestamp>', 'timestamp the migration. Example: 20180701182602')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .action(async (timestamp, environment) => {
    const authData = await fetchSettings(environment, program);
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
