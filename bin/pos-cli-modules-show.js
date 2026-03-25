#!/usr/bin/env node

import { program } from '../lib/program.js';
import { withSpinner } from '../lib/spinner.js';
import { showModuleVersions } from '../lib/modules/show.js';

program
  .name('pos-cli modules show')
  .argument('<module-name>', 'name of the module. Example: core')
  .action(async (moduleName) => {
    await withSpinner('Modules show', async (spinner) => {
      await showModuleVersions(spinner, moduleName);
    });
  });

program.parse(process.argv);
