#!/usr/bin/env node

import { program } from '../lib/program.js';
import { withSpinner } from '../lib/spinner.js';
import { updateModules } from '../lib/modules/update.js';

program
  .name('pos-cli modules update')
  .arguments('[module-name]', 'name of the module. Example: core. You can also pass version number: core@1.0.0. Omit to update all modules.')
  .option('--dev', 'update devDependencies (or treat named module as a devDependency)')
  .action(async (moduleNameWithVersion, params) => {
    await withSpinner('Updating module', async (spinner) => {
      await updateModules(spinner, moduleNameWithVersion, { dev: params.dev });
    });
  });

program.parse(process.argv);
