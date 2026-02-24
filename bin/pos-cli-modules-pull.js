#!/usr/bin/env node

import { program } from '../lib/program.js';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fetchSettings } from '../lib/settings.js';
import downloadFile from '../lib/downloadFile.js';
import waitForStatus from '../lib/data/waitForStatus.js';
import ora from 'ora';

program
  .name('pos-cli modules pull')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .arguments('[module]', 'module name to pull')
  .action(async (environment, module, _params) => {

    const spinner = ora({ text: 'Exporting', stream: process.stdout });

    const filename = 'modules.zip';
    spinner.start();
    const authData = await fetchSettings(environment, program);
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
