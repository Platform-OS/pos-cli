#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import { uploadFile } from '../lib/s3UploadFile.js';
import { presignUrl } from '../lib/presignUrl.js';
import logger from '../lib/logger.js';
import ora from 'ora';

const uploadZip = async (filepath, gateway) => {

  const spinner = ora({ text: 'Sending file', stream: process.stdout });
  spinner.start();

  try {
    const instanceId = (await gateway.getInstance()).id;
    const propertyUploadsDirectory = `instances/${instanceId}/property_uploads/data.public_property_upload_import.zip`;
    logger.Debug(propertyUploadsDirectory);
    const { uploadUrl } = await presignUrl(propertyUploadsDirectory, filepath);
    await uploadFile(filepath, uploadUrl);

    spinner.stopAndPersist().succeed('Upload done.');
  } catch (error) {
    logger.Debug(error);
    spinner.fail('Upload failed');
    logger.Error('Unable to upload archive file');
  }

};

program
  .name('pos-cli uploads push')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <path>', 'path of .zip file that contains files used in property of type upload', 'uploads.zip')
  .action(async (environment, params) => {
    const path = params.path;
    const authData = await fetchSettings(environment, program);
    Object.assign(process.env, { MARKETPLACE_TOKEN: authData.token, MARKETPLACE_URL: authData.url });

    if (!fs.existsSync(path)) logger.Error(`File not found: ${path}`);
    gateway = new Gateway(authData);
    uploadZip(path, gateway);
  });

program.parse(process.argv);
