#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  shell = require('shelljs'),
  Gateway = require('../lib/proxy'),
  fetchAuthData = require('../lib/settings').fetchSettings,
  fetchFiles = require('../lib/data/fetchFiles'),
  waitForStatus = require('../lib/data/waitForStatus'),
  downloadFile = require('../lib/downloadFile');

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

const transform = ({ users = { results: [] }, transactables = { results: [] }, models = { results: [] } }) => {
  return {
    users: users.results,
    transactables: transactables.results,
    models: models.results,
  };
};

const fetchFilesForData = async (data) => {
  // TODO: user properties
  data.users = await Promise.all(
    data.users.map(async (user) => {
      user.profiles = await Promise.all(user.profiles.map((profile) => fetchFiles(profile)));
      return user;
    })
  );
  data.transactables = await Promise.all(data.transactables.map((model) => fetchFiles(model)));
  data.models = await Promise.all(data.models.map((model) => fetchFiles(model)));

  return data;
};

program
  .name('pos-cli data export')
  .arguments('[environment]', 'name of the environment. Example: staging')
  .requiredOption('-p --path <export-file-path>', 'output for exported data. Example: data.json, data.zip')
  .option(
    '-e --export-internal-ids <export-internal-ids>',
    'use normal object `id` instead of `external_id` in exported json data',
    'false'
  )
  .option('-z --zip', 'export to zip archive', false)
  .action(async (environment, params) => {

    await initializeEsmModules();
    const spinner = ora({ text: 'Exporting', stream: process.stdout });

    const isZipFile = params.zip;
    let filename = params.path;
    if (!filename) {
      filename = isZipFile ? 'data.zip' : 'data.json';
    }
    const exportInternalIds = params.exportInternalIds;
    const authData = fetchAuthData(environment, program);
    gateway = new Gateway(authData);

    const exportFinished = () => {
      spinner.stopAndPersist().succeed(`Done. Exported to: ${filename}`);
    };

    const handleZipFileExport = (exportTask, filename) => {
      downloadFile(exportTask.zip_file_url, filename).then(exportFinished);
    };

    const handleJsonFileExport = (exportTask, filename) => {
      shell.mkdir('-p', 'tmp');
      fs.writeFileSync('tmp/exported.json', JSON.stringify(exportTask.data));
      let data = transform(exportTask.data);
      spinner.succeed('Downloading files');
      fetchFilesForData(data)
        .then((data) => {
          fs.writeFileSync(filename, JSON.stringify(data));
          exportFinished();
        })
        .catch((e) => {
          logger.Warn('export error');
          logger.Warn(e.message);
        });
    };

    spinner.start();
    gateway
      .dataExportStart(exportInternalIds, isZipFile)
      .then((exportTask) => {
        waitForStatus(() => gateway.dataExportStatus(exportTask.id, isZipFile), 'pending', 'done')
          .then((exportTask) => {
            if (isZipFile) {
              handleZipFileExport(exportTask, filename);
            } else {
              handleJsonFileExport(exportTask, filename);
            }
            report('[OK] Data: Export');
          })
          .catch((error) => {
            logger.Debug(error);
            spinner.fail('Export failed');
          });
      })
      .catch({ statusCode: 404 }, () => {
        spinner.fail('Export failed');
        logger.Error('[404] Data export is not supported by the server');
        report('[ERR] Data: Export - Not supported');
      })
      .catch((e) => {
        spinner.fail('Export failed');
        logger.Error(e.message);
        report('[ERR] Data: Export - Failed');
      });
  });

program.parse(process.argv);
