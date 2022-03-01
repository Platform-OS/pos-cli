#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  shell = require('shelljs'),
  crypto = require('crypto'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  transform = require('../lib/data/uploadFiles'),
  isValidJSON = require('../lib/data/isValidJSON'),
  waitForStatus = require('../lib/data/waitForStatus'),
  uploadFile = require('../lib/s3UploadFile').uploadFile,
  presignUrl = require('../lib/presignUrl').presignUrl;

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

let gateway;
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });
const tmpFileName = './tmp/data-imported.json';

const logInvalidFile = (filename) => {
  return logger.Error(
    `
Invalid format of ${filename}. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com .
Do you want to import a zip file? Use --zip.
    `
  );
};

const dataImport = async (filename, rawIds, isZipFile) => {
  spinner.start();

  let formData = {};
  if (isZipFile) {
    const instanceId = (await gateway.getInstance()).id;
    const uploadedFilename = `instances/${instanceId}/data_imports/${crypto.randomBytes(32).toString('hex')}`;
    try {
      const { uploadUrl, accessUrl } = await presignUrl(uploadedFilename, filename);
      await uploadFile(filename, uploadUrl);
      formData = { zip_file_url: accessUrl };
    } catch (error) {
      logger.Debug(error);
      spinner.fail('Import failed');
      logger.Error('Unable to upload archive file');
    }
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
    .then((importTask) => {
      spinner.stopAndPersist().succeed('Data sent').start(`Importing ${filename}`);
      waitForStatus(() => gateway.dataImportStatus(importTask.id, isZipFile))
        .then(() => {
          spinner.stopAndPersist().succeed('Import done.');
          report('[OK] Data: Import');
        })
        .catch((error) => {
          logger.Debug(error);
          spinner.fail('Import failed');
          logger.Error('Unable to import data file');
        });
    })
    .catch({ statusCode: 404 }, () => {
      spinner.fail('Import failed');
      logger.Error('[404] Data import is not supported by the server');
    })
    .catch((e) => {
      spinner.fail('Import failed');
      logger.Error(e.message);
      report('[ERR] Data: Import');
    });
};

program
  .name('pos-cli data import')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option(
    '-p --path <import-file-path>',
    'path of import .json or .zip file. Example: data.json, data.zip',
    'data.json'
  )
  .option('--raw-ids <raw-ids>', 'do not remap ids after import', 'false')
  .option('-z --zip', 'import from zip archive', 'false')
  .action((environment, params) => {
    const filename = params.path;
    const rawIds = params.rawIds;
    const zip = params.zip;
    const authData = fetchAuthData(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
    });

    if (!fs.existsSync(filename)) {
      logger.Error(`File not found: ${filename}`);
    }

    gateway = new Gateway(authData);
    dataImport(filename, rawIds, zip);
  });

program.parse(process.argv);
