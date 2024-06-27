#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  transform = require('../lib/data/uploadFiles'),
  isValidJSON = require('../lib/data/isValidJSON');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

// importing ESM modules in CommonJS project
let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
}

let gateway;

program
  .name('pos-cli data update')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <update-file-path>', 'path of update .json file', 'data.json')
  .action(async (environment, params) => {

    const filename = params.path;
    const authData = fetchAuthData(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
    });

    await initializeEsmModules();
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
