#!/usr/bin/env node

import { program } from 'commander';
import degit from 'degit';

import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';
import dir from '../lib/directories.js';

const moduleRepo = 'Platform-OS/pos-module-template';

function createModuleStructure(moduleName) {
  degit(moduleRepo, { force: true, cache: false, verbose: false })
    .clone(`${dir.MODULES}/${moduleName}`)
    .then(() => {
      report('[OK] Module init');
      logger.Success('Module directory structure successfully created.');
    })
    .catch((error) => {
      report('[ERR] Module init');
      logger.Error(`Module structure cloning is failed. Reason: ${error.message}`);
    });
}

program
  .name('pos-cli modules init')
  .arguments('<name>', 'name of the module to create. Example: profile')
  .action(name => {
    createModuleStructure(name);
  });

program.parse(process.argv);
