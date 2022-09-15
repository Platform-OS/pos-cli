#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report'),
  dir = require('../lib/directories');

function cloneModule(moduleName) {
  const moduleRepo = `Platform-OS/pos-module-${moduleName}`;
  degit(moduleRepo, { force: true, cache: false, verbose: false })
    .clone(`${dir.MODULES}/${moduleName}`)
    .then(() => {
      report(`[OK] "${moduleRepo}" module is downloaded to "${moduleName}"`);
      logger.Success(`"${moduleRepo}" module is downloaded to "${moduleName}"`);
    })
    .catch((error) => {
      report(`[ERR] Can not download "${moduleRepo}" module into "${moduleName}" because "${error.message}"`);
      logger.Error(`Can not download "${moduleRepo}" module into "${moduleName}" because "${error.message}"`);
    });
}

program
  .name('pos-cli modules install')
  .arguments('<name>', 'name of the module to download. Do not use "pos-module-" prefix, so use "user" instead of "pos-module-user"')
  .action(name => {
    cloneModule(name);
  });

program.parse(process.argv);
