#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  path = require('path'),
  ora = require('ora'),
  cloneDeep = require('lodash.clonedeep'),
  glob = require('fast-glob'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  uploadFile = require('../lib/s3UploadFile').uploadFile,
  uploadFileFormData = require('../lib/s3UploadFile').uploadFileFormData,
  presignUrl = require('../lib/presignUrl').presignUrl,
  presignDirectory = require('../lib/presignUrl').presignDirectory,
  logger = require('../lib/logger');


let gateway;
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });

const uploadZip = async (directory) => {
  spinner.start();
  const instanceId = (await gateway.getInstance()).id;
  const propertyUploadsDirectory = `instances/${instanceId}/property_uploads/uploads_data.zip`;
  try {
    const { uploadUrl } = await presignUrl(propertyUploadsDirectory, directory);
    await uploadFile(directory, uploadUrl);

    spinner.stopAndPersist().succeed('Upload done.');
  } catch (error) {
    logger.Debug(error);
    spinner.fail('Upload failed');
    logger.Error('Unable to upload archive file');
  }
};

const uploadDirectory = async (directory) => {
  spinner.start();
  const instanceId = (await gateway.getInstance()).id;
  const propertyUploadsDirectory = `instances/${instanceId}/property_uploads`;

  try {
    const data = await presignDirectory(propertyUploadsDirectory);
    const files = await glob(`${directory}/**`);
    logger.Debug(files);
    for (const file of files) {
      let dataForFile = cloneDeep(data);
      const fileSubdir = path.dirname(file.replace(directory, ''))
      const key = data.fields.key.replace('property_uploads/${filename}', `property_uploads${fileSubdir}/\${filename}`);
      data.fields.key = key;

      await uploadFileFormData(file, data);
    }
    spinner.stopAndPersist().succeed('Upload done.');
  } catch (error) {
    console.log(error);
    logger.Debug(error);
    spinner.fail('Upload failed');
    logger.Error('Unable to upload archive file');
  }
}


program
  .name('pos-cli uploads upload')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <path>', 'path of uploads directory')
  .action((environment, params) => {
    const path = params.path;
    const authData = fetchAuthData(environment, program);
    Object.assign(process.env, {
      MARKETPLACE_TOKEN: authData.token,
      MARKETPLACE_URL: authData.url,
    });

    if (!fs.existsSync(path)) logger.Error(`File not found: ${path}`);
    gateway = new Gateway(authData);
    // uploadZip(path);
    uploadDirectory(path);
  });

program.parse(process.argv);
