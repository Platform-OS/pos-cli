#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  fs = require('fs'),
  path = require('path'),
  watch = require('node-watch'),
  notifier = require('node-notifier'),
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
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

CONCURRENCY = 3;
const Queue = require('async/queue');

const queue = Queue((task, callback) => {
  pushFile(task.path).then(callback, callback);
}, CONCURRENCY);

const enqueue = filePath => {
  queue.push({ path: filePath }, () => {
    true;
  });
};

const pushFile = filePath => {
  return new Promise((resolve, reject) => {
    const formData = {
      path: filePathUnixified(filePath), // need path with / separators
      marketplace_builder_file_body: fs.createReadStream(filePath)
    };

    gateway.sync(formData).then(
      body => {
        if (body['refresh_index'])
          logger.Warn('WARNING: Data schema was updated. It will take a while for the change to be applied.');

        logger.Success(`[Sync] ${filePath} - done`);
        resolve('OK');
      },
      error => {
        notifier.notify({ title: 'MarkeplaceKit Sync Error', message: error });
        logger.Error(`[Sync] ${filePath} - ${error}`);
        resolve('error but OK');
      }
    );
  });
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

const gateway = new Gateway(program);

gateway.ping().then(
  () => {
    if (!fs.existsSync('marketplace_builder')) {
      logger.Error("marketplace_builder directory doesn't exist - cannot start watching it");
      process.exit(1);
    }

    watch('marketplace_builder', { recursive: true }, (event, file) => {
      shouldBeSynced(file, event) && enqueue(file);
    });
  },
  error => {
    logger.Error(error);
    process.exit(1);
  }
);
