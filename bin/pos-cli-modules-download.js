#!/usr/bin/env node

const shell = require('shelljs');
const program = require('commander');
const ora = require('ora');
const Gateway = require('../lib/proxy');
const logger = require('../lib/logger');
const downloadFile = require('../lib/downloadFile');
const spinner = ora({ text: 'Exporting', stream: process.stdout, spinner: 'bouncingBar' });
const { unzip } = require('../lib/unzip');
const Portal = require('../lib/portal');

program
  .name('pos-cli modules download')
  .arguments('<module>', 'module name, ex. core, core@1.0.0')
  .action((module, params) => {
    const filename = 'modules.zip';
    spinner.start();
    const environment = params.env;
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
