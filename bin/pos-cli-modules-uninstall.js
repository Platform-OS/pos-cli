#!/usr/bin/env node

import { program } from '../lib/program.js';
import { withSpinner } from '../lib/spinner.js';
import { uninstallModule } from '../lib/modules/uninstall.js';

program
  .name('pos-cli modules uninstall')
  .arguments('<module-name>', 'name of the module to uninstall. Example: core')
  .option('--dev', 'remove module from devDependencies')
  .action(async (moduleName, params) => {
    await withSpinner('Modules uninstall', async (spinner) => {
      await uninstallModule(spinner, moduleName, { dev: params.dev });
    });
  });

program.parse(process.argv);
