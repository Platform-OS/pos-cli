#!/usr/bin/env node

import { program } from '../lib/program.js';
import { withSpinner } from '../lib/spinner.js';
import { installModules } from '../lib/modules/install.js';

program
  .name('pos-cli modules install')
  .arguments('[module-name]', 'name of the module. Example: core. You can also pass version number: core@1.0.0')
  .option('--dev', 'add module to devDependencies (or include devDependencies when installing all)')
  .option('--frozen', 'use lock file as-is without re-resolving; fails if lock file is missing or stale (for CI)')
  .action(async (moduleNameWithVersion, params) => {
    await withSpinner('Modules install', async (spinner) => {
      await installModules(spinner, moduleNameWithVersion, { dev: params.dev, frozen: params.frozen });
    });
  });

program.parse(process.argv);
