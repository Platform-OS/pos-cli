#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  shell = require('shelljs'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  fetchFiles = require('./lib/data/fetchFiles'),
  waitForStatus = require('./lib/data/waitForStatus'),
  version = require('./package.json').version;

let gateway;
const spinner = ora({ text: 'Exporting', stream: process.stdout, spinner: 'bouncingBar' });
const transform = ({ users = { results: [] }, transactables = { results: [] }, models = { results: [] } }) => {
  return {
    users: users.results,
    transactables: transactables.results,
    models: models.results
  };
};

async function fetchFilesForData(data) {
  // TODO: user properties
  data.users = await Promise.all(data.users.map(async(user) => {
    user.profiles = await Promise.all(user.profiles.map(profile => fetchFiles(profile)));
    return user;
  }));
  data.transactables = await Promise.all(data.transactables.map(model => fetchFiles(model)));
  data.models = await Promise.all(data.models.map(model => fetchFiles(model)));

  return data;
};

program
  .version(version)
  .arguments('[environment]', 'name of the environment. Example: staging')
  .option('-p --path <export-file-path>', 'output for exported data', 'data.json')
  .option('-e --export-internal-ids <export-internal-ids>', 'use normal object `id` instead of `external_id` in exported json data',
    'false')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const filename = params.path;
    const exportInternalIds = params.exportInternalIds;
    const authData = fetchAuthData(environment, program, program);
    gateway = new Gateway(authData);
    spinner.start();
    gateway
      .dataExportStart(exportInternalIds)
      .then(exportTask => {
        waitForStatus(exportTask.id, gateway.dataExportStatus).then(exportTask => {
          shell.mkdir('-p', 'tmp');
          fs.writeFileSync('tmp/exported.json', JSON.stringify(exportTask.data));
          let data = transform(exportTask.data);
          spinner.succeed('Downloading files');
          fetchFilesForData(data).then(data => {
            fs.writeFileSync(filename, JSON.stringify(data));
            spinner.stopAndPersist().succeed(`Done. Exported to: ${filename}`);
          }).catch(e => {
            logger.Warn('export error');
            logger.Warn(e.message);
          });
        }).catch(error => {
          spinner.fail('Export failed');
        });
      })
      .catch(
        { statusCode: 404 },
        () => {
          spinner.fail('Export failed');
          logger.Error('[404] Data export is not supported by the server');
        }
      )
      .catch(e => {
        spinner.fail('Export failed');
        logger.Error(e.message);
      });
  });

program.parse(process.argv);
