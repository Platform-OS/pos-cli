#!/usr/bin/env node

import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';
import downloadFile from '../lib/downloadFile.js';
import waitForStatus from '../lib/data/waitForStatus.js';

import ora from 'ora';

program
  .name('pos-cli pull')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <export-file-path>', 'output for exported data', 'app.zip')
  .action(async (environment, params) => {
    const filename = params.path;
    const authData = fetchSettings(environment, program);
    let gateway = new Gateway(authData);

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
