#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  dir = require('../lib/directories');

const moduleRepo = 'hosszukalman/pos-module-structure';

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
  .arguments('<name>', 'base name of the migration. Example: cleanup_data')
  .action(name => {
    createModuleStructure(name);
  });

program.parse(process.argv);
