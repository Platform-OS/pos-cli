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
const { unzip } = require('../lib/unzip');
const Portal = require('../lib/portal');

program
  .name('pos-cli modules pull')
  .arguments('[module]', 'module name to pull, ex. core, core@1.0.0')
  .option('--env <env>', 'name of the environment. Example: staging')
  .action((module, params) => {
    const filename = 'modules.zip';
    spinner.start();
    let flow;
    const environment = params.env;
    if (environment){
      const authData = fetchAuthData(environment, program);
      const gateway = new Gateway(authData);
      flow = gateway
        .appExportStart({ module_name: module })
        .then(exportTask => waitForStatus(() => gateway.appExportStatus(exportTask.id), 'ready_for_export', 'success'))
        .then(exportTask => downloadFile(exportTask.zip_file.url, filename))
        .then(() => unzip(filename, process.cwd()))
    } else {
      flow = Portal.moduleVersionsSearch(module)
        .then(moduleVersion => downloadFile(moduleVersion['public_archive'], filename))
        .then(() => unzip(filename, `${process.cwd()}/modules`))
    }

    flow
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
