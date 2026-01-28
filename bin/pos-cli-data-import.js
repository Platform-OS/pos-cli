#!/usr/bin/env node

import fs from 'fs';
import crypto from 'crypto';
import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import transform from '../lib/data/uploadFiles.js';
import isValidJSON from '../lib/data/isValidJSON.js';
import waitForStatus from '../lib/data/waitForStatus.js';
import { uploadFile } from '../lib/s3UploadFile.js';
import { presignUrl } from '../lib/presignUrl.js';
import logger from '../lib/logger.js';
import report from '../lib/logger/report.js';
import ora from 'ora';
  
let gateway;

const logInvalidFile = (filename) => {
  return logger.Error(
    `
Invalid format of ${filename}. Must be a valid json file. Check file using one of JSON validators online: https://jsonlint.com .
Do you want to import a zip file? Use --zip.
    `
  );
};

const dataImport = async (filename, rawIds, isZipFile) => {

  const spinner = ora({ text: 'Sending data', stream: process.stdout });

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
    formData = { 'import': { 'data': transformedData } };
  }

  formData['raw_ids'] = rawIds;
  gateway
    .dataImportStart(formData)
    .then((importTask) => {
      spinner.stopAndPersist().succeed('Data sent').start(`Importing ${filename}`);
      waitForStatus(() => gateway.dataImportStatus(importTask.id, isZipFile), 'pending', 'done')
        .then(() => {
          spinner.stopAndPersist().succeed('Import done.');
          report('[OK] Data: Import');
        })
        .catch((error) => {
          logger.Debug(error);
          spinner.fail('Import failed');
          logger.Error(`Unable to import data file. Error: ${error.error}`);
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
  .argument('[environment]', 'name of the environment. Example: staging')
  .option(
    '-p --path <import-file-path>',
    'path of import .json or .zip file. Example: data.json, data.zip',
    'data.json'
  )
  .option('--raw-ids <raw-ids>', 'do not remap ids after import', false)
  .option('-z --zip', 'import from zip archive', false)
  .action(async (environment, params) => {
    const filename = params.path;
    const rawIds = params.rawIds;
    const zip = params.zip;
    const authData = await fetchSettings(environment);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url
    });

    if (!fs.existsSync(filename)) {
      logger.Error(`File not found: ${filename}`);
    }

    gateway = new Gateway(authData);
    dataImport(filename, rawIds, zip);
  });

program.parse(process.argv);
