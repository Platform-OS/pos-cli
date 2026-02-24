#!/usr/bin/env node

import fs from 'fs';
import { program } from '../lib/program.js';
import shell from 'shelljs';

import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';
import { fetchSettings } from '../lib/settings.js';
import dir from '../lib/directories.js';

program
  .name('pos-cli migrations generate')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('<name>', 'base name of the migration. Example: cleanup_data')
  .action(async (environment, name) => {
    const authData = await fetchSettings(environment, program);
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
