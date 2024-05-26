#!/usr/bin/env node

const shell = require('shelljs');
const program = require('commander');
const ora = require('ora');
const Gateway = require('../lib/proxy');
const logger = require('../lib/logger');
const fetchAuthData = require('../lib/settings').fetchSettings;
const downloadFile = require('../lib/downloadFile');
const waitForStatus = require('../lib/data/waitForStatus');
const spinner = ora({ text: 'Exporting', stream: process.stdout, spinner: 'bouncingBar' });

program
  .name('pos-cli modules pull')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('[module]', 'module name to pull')
  .action((environment, module, params) => {
    const filename = 'modules.zip';
    spinner.start();
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);
    gateway
      .appExportStart({ module_name: module })
      .then(exportTask => waitForStatus(() => gateway.appExportStatus(exportTask.id), 'ready_for_export', 'success'))
      .then(exportTask => downloadFile(exportTask.zip_file.url, filename))
      .then(() => spinner.succeed('Downloading files'))
      .catch({ statusCode: 404 }, () => {
        spinner.fail(`Pulling ${module} failed.`);
        logger.Error('[404] Zip file with module files not found');
      })
      .catch(e => {
        spinner.fail(`Pulling ${module} failed.`);
        logger.Error(e.message || e.error.error || e.error);
      });
  });

program.parse(process.argv);
