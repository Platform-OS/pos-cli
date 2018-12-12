#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
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

const getExportStatus = id => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      gateway.dataExportStatus(id).then(response => {
        if (response.status === 'pending') {
          setTimeout(getStatus, 1500);
        } else if (response.status === 'done') {
          resolve(response);
        } else {
          spinner.fail('Export failed');
        }
      });
    })();
  });
};

program
  .version(version)
  .arguments('<environment>', 'name of the environment. Example: staging')
  .option('-p --path <export-file-path>', 'output for exported data', 'data.json')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const filename = params.path;
    const authData = fetchAuthData(environment);
    gateway = new Gateway(authData);

    spinner.start();
    gateway
      .dataExportStart()
      .then(exportTask => {
        getExportStatus(exportTask.id).then(exportTask => {
          fs.writeFileSync(filename, JSON.stringify(transform(exportTask.data)));
          spinner.stopAndPersist().succeed(`Done. Exported to: ${filename}`);
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
if (!program.args.length) program.help();
