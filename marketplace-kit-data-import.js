#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  ora = require('ora'),
  Gateway = require('./lib/proxy'),
  logger = require('./lib/logger'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  transform = require('./lib/data/uploadFiles'),
  isValidJSON = require('./lib/data/isValidJSON'),
  version = require('./package.json').version;

let gateway;
const spinner = ora({ text: 'Sending data', stream: process.stdout, spinner: 'bouncingBar' });

PARTNER_PORTAL_HOST = process.env.PARTNER_PORTAL_HOST || 'https://portal.apps.near-me.com';

program
  .version(version)
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

    const data = fs.readFileSync(filename, 'utf8');

    if (!isValidJSON(data)) {
      return logger.Failed(
        `Invalid format of ${filename}. Must be a valid json file. Check your file using one of JSON validators online.
For example: https://jsonlint.com`
      );
    }

    spinner.start();
    transform(JSON.parse(data)).then(transformedData => {
      const tmpFileName = './tmp/data-imported.json';
      fs.writeFileSync(tmpFileName, JSON.stringify(transformedData));
      const formData = { 'import[data]': fs.createReadStream(tmpFileName) };
      gateway
        .dataImport(formData)
        .then(() => {
          spinner
            .stopAndPersist()
            .succeed('Import scheduled. Check marketplace-kit logs for info when it is done.');
        })
        .catch({ statusCode: 404 }, () => {
          spinner.fail('Import failed');
          logger.Error('[404] Data import is not supported by the server');
        })
        .catch(e => {
          spinner.fail('Import failed');
          logger.Error(e);
          logger.Error(e.message);
        });
    });
  });

program.parse(process.argv);
