#!/usr/bin/env node

const program = require('commander'),
  request = require('request'),
  fs = require('fs'),
  path = require('path'),
  shell = require('shelljs'),
  watch = require('node-watch'),
  notifier = require('node-notifier'),
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
  platformRequestHeaders = require('./lib/platformRequestHeaders'),
  watchFilesExtensions = require('./lib/watch-files-extensions'),
  version = require('./package.json').version;

const shouldBeSynced = (filePath, event) => {
  return fileUpdated(event) && extensionAllowed(ext(filePath)) && !isHiddenFile(filename(filePath));
};

const isHiddenFile = filename => filename.startsWith('.');
const ext = path => path.split('.').pop();
const extensionAllowed = ext => watchFilesExtensions.includes(ext);
const filename = filePath => filePath.split(path.sep).pop();
const fileUpdated = event => event === 'update';
const filePathUnixified = filePath => filePath.replace(/\\/g, '/').replace('marketplace_builder/', '');

const ping = authData => {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: authData.url + 'api/marketplace_builder/logs',
        method: 'GET',
        headers: platformRequestHeaders({ email: authData.email, token: authData.token })
      },
      (error, response, body) => {
        if (error) reject({ status: error });
        else if (response.statusCode != 200)
          reject({
            status: response.statusCode,
            message: response.statusMessage
          });
        else resolve('OK');
      }
    );
  });
};

const pushFile = filePath => {
  logger.Info(`[Sync] ${filePath}`);

  request(
    {
      uri: program.url + 'api/marketplace_builder/marketplace_releases/sync',
      method: 'PUT',
      headers: platformRequestHeaders({ email: program.email, token: program.token }),
      formData: {
        path: filePathUnixified(filePath), // need path with / separators
        marketplace_builder_file_body: fs.createReadStream(filePath)
      }
    },
    (error, response, body) => {
      if (error) {
        logger.Error(error);
      } else {
        if (body != '{}') {
          notifier.notify({ title: 'MarkeplaceKit Sync Error', message: body });
          logger.Error(` - ${body}`);
        } else {
          logger.Success(`[Sync] ${filePath} - done`);
        }
      }
    }
  );
};

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: program.help.bind(program) });
};

program
  .version(version)
  .option('--email <email>', 'authentication token', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL)
  // .option('--files <files>', 'watch files', process.env.FILES || watchFilesExtensions)
  .parse(process.argv);

checkParams(program);

logger.Info(`Enabling sync mode. Syncing to: [${program.url}] \n ---`);

ping(program).then(
  () => {
    if (!fs.existsSync('marketplace_builder')) {
      logger.Error("marketplace_builder directory doesn't exist - cannot start watching it");
      process.exit(1);
    }

    watch('marketplace_builder', { recursive: true }, (event, file) => {
      shouldBeSynced(file, event) && pushFile(file);
    });
  },
  error => {
    logger.Error(error);
    process.exit(1);
  }
);
