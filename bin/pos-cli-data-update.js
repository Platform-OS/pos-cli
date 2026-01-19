#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import transform from '../lib/data/uploadFiles.js';
import isValidJSON from '../lib/data/isValidJSON.js';
import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';
import ora from 'ora';

let gateway;

program
  .name('pos-cli data update')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <update-file-path>', 'path of update .json file', 'data.json')
  .action(async (environment, params) => {

    const filename = params.path;
    const authData = fetchSettings(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });

    const spinner = ora({ text: 'Sending data', stream: process.stdout });

    gateway = new Gateway(authData);

    const data = fs.readFileSync(filename, 'utf8');

    if (!isValidJSON(data)) {
      return logger.Failed(
        `Invalid format of ${filename}. Must be a valid json file. Check your file using one of JSON validators online.
For example: https://jsonlint.com`
      );
    }

    spinner.start();
    transform(JSON.parse(data))
      .then((transformedData) => {
        const tmpFileName = './tmp/data-updated.json';
        fs.writeFileSync(tmpFileName, JSON.stringify(transformedData));
        const formData = { 'update[data]': fs.createReadStream(tmpFileName) };
        gateway.dataUpdate(formData).then(() => {
          spinner.stopAndPersist().succeed('Update scheduled. Check pos-cli logs for info when it is done.');
          report('[OK] Data: Update');
        });
      })
      .catch({ statusCode: 404 }, () => {
        spinner.fail('Update failed');
        logger.Error('[404] Data update is not supported by the server');
      })
      .catch((e) => {
        spinner.fail('Update failed');
        logger.Error(e.message);
        report('[ERR] Data: Update');
      });

  });

program.parse(process.argv);
