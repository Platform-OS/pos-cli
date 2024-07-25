#!/usr/bin/env node

const { program } = require('commander'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  downloadFile = require('../lib/downloadFile'),
  waitForStatus = require('../lib/data/waitForStatus');
  
// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

program
  .name('pos-cli pull')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <export-file-path>', 'output for exported data', 'app.zip')
  .action(async (environment, params) => {
    const filename = params.path;
    const authData = fetchAuthData(environment, program);
    let gateway = new Gateway(authData);

    await initializeEsmModules();
    const spinner = ora({ text: 'Exporting', stream: process.stdout });
    spinner.start();

    gateway
      .appExportStart()
      .then(exportTask => {
        waitForStatus(() => gateway.appExportStatus(exportTask.id), 'ready_for_export', 'success')
          .then(exportTask => downloadFile(exportTask.zip_file.url, filename))
          .then(() => spinner.succeed('Downloading files'))
          .catch(error => {
            logger.Debug(error);
            spinner.fail('Export failed');
          });
      })
      .catch({ statusCode: 404 }, () => {
        spinner.fail('Export failed');
        logger.Error('[404] Data export is not supported by the server');
      })
      .catch(e => {
        spinner.fail('Export failed');
        logger.Error(e.message);
      });
  });

program.parse(process.argv);
