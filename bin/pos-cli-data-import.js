#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  shell = require('shelljs'),
  Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  transform = require('../lib/data/uploadFiles'),
  isValidJSON = require('../lib/data/isValidJSON'),
  waitForStatus = require('../lib/data/waitForStatus'),
  path = require('path');

let gateway;
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });
const tmpFileName = './tmp/data-imported.json';

const logInvalidFile = filename => {
  return logger.Error(
    `Invalid format of ${filename}. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com`
  );
};

const dataImport = async (filename, rawIds) => {
  spinner.start();

  let formData = {};
  if (path.extname(filename) === '.zip') {
    formData = { 'zip_file': fs.createReadStream(filename) };
  } else {
    const data = fs.readFileSync(filename, 'utf8');
    if (!isValidJSON(data)) return logInvalidFile(filename);
    const transformedData = await transform(JSON.parse(data));
    shell.mkdir('-p', './tmp');
    fs.writeFileSync(tmpFileName, JSON.stringify(transformedData));
    formData = { 'import[data]': fs.createReadStream(tmpFileName) };
  }

  formData['raw_ids'] = rawIds;
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
  .option('-p --path <import-file-path>', 'path of import .json or .zip file', 'data.json, data.zip')
  .option('--raw-ids <raw-ids>', 'do not remap ids after import', 'false')
  .action((environment, params) => {
    const filename = params.path;
    const rawIds = params.rawIds;
    const authData = fetchAuthData(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });

    gateway = new Gateway(authData);
    dataImport(filename, rawIds);
  });

program.parse(process.argv);
