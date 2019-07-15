#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  shell = require('@platform-os/shelljs'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  transform = require('../lib/data/uploadFiles'),
  isValidJSON = require('../lib/data/isValidJSON'),
  waitForStatus = require('../lib/data/waitForStatus');

let gateway;
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });
const tmpFileName = './tmp/data-imported.json';

const logInvalidFile = filename => {
  return logger.Error(
    `Invalid format of ${filename}. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com`
  );
};

const dataImport = async filename => {
  const data = fs.readFileSync(filename, 'utf8');
  if (!isValidJSON(data)) return logInvalidFile(filename);

  spinner.start();
  const transformedData = await transform(JSON.parse(data));
  shell.mkdir('-p', './tmp');
  fs.writeFileSync(tmpFileName, JSON.stringify(transformedData));
  const formData = { 'import[data]': fs.createReadStream(tmpFileName) };
  gateway
    .dataImportStart(formData)
    .then(importTask => {
      spinner
        .stopAndPersist()
        .succeed('Data sent')
        .start('Importing data');
      waitForStatus(() => gateway.dataImportStatus(importTask.id))
        .then(() => {
          spinner.stopAndPersist().succeed('Import done.');
        })
        .catch(error => {
          logger.Debug(error);
          spinner.fail('Import failed');
        });
    })
    .catch({ statusCode: 404 }, () => {
      spinner.fail('Import failed');
      logger.Error('[404] Data import is not supported by the server');
    })
    .catch(e => {
      spinner.fail('Import failed');
      logger.Error(e.message);
    });
};

program
  .name('pos-cli data import')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <import-file-path>', 'path of import .json file', 'data.json')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const filename = params.path;
    const authData = fetchAuthData(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });

    gateway = new Gateway(authData);
    dataImport(filename);
  });

program.parse(process.argv);
