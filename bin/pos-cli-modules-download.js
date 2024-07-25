#!/usr/bin/env node

const shell = require('shelljs');
const { program } = require('commander');
const logger = require('../lib/logger');
const downloadFile = require('../lib/downloadFile');

const { unzip } = require('../lib/unzip');
const Portal = require('../lib/portal');

// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

program
  .name('pos-cli modules download')
  .arguments('<module>', 'module name, ex. core, core@1.0.0')
  .action(async (module, params) => {
    const filename = 'modules.zip';

    await initializeEsmModules();
    const spinner = ora({ text: 'Exporting', stream: process.stdout });
    spinner.start();

    Portal.moduleVersionsSearch(module)
      .then(moduleVersion => downloadFile(moduleVersion['public_archive'], filename))
      .then(() => unzip(filename, `${process.cwd()}/modules`))
      .then(() => shell.rm(filename))
      .then(() => spinner.succeed('Downloading files'))
      .catch({ statusCode: 404 }, () => {
        spinner.fail('Export failed');
        logger.Error('[404] Module not found');
      })
      .catch(e => {
        spinner.fail('Export failed');
        logger.Error(e.message);
      });
  });

program.parse(process.argv);
