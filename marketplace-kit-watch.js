#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('./lib/proxy'),
  fs = require('fs'),
  path = require('path'),
  watch = require('node-watch'),
  Queue = require('async/queue'),
  logger = require('./lib/logger'),
  validate = require('./lib/validators'),
  watchFilesExtensions = require('./lib/watch-files-extensions'),
  version = require('./package.json').version;

const ext = filePath => filePath.split('.').pop();
const filename = filePath => filePath.split(path.sep).pop();
const filePathUnixified = filePath => filePath.replace(/\\/g, '/').replace('marketplace_builder/', '');

const shouldBeSynced = (filePath, event) => {
  return fileUpdated(event) && extensionAllowed(filePath) && isNotHidden(filePath) && isNotEmptyYML(filePath);
};

const fileUpdated = event => event === 'update';

const extensionAllowed = filePath => {
  const allowed = watchFilesExtensions.includes(ext(filePath));
  if (!allowed) {
    logger.Debug(`[Sync] Not syncing, not allowed file extension: ${filePath}`);
  }
  return allowed;
};

const isNotHidden = filePath => {
  const isHidden = filename(filePath).startsWith('.');
  if (isHidden) {
    logger.Info(`[Sync] Not syncing hidden file: ${filePath}`);
  }
  return !isHidden;
};

const isNotEmptyYML = filePath => {
  if (ext(filePath) === 'yml') {
    logger.Info(`[Sync] Not syncing empty YML file: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8', (err, data) => data.length > 0);
  }
  return true;
};

CONCURRENCY = 3;

const queue = Queue((task, callback) => {
  pushFile(task.path).then(callback, callback);
}, CONCURRENCY);

const enqueue = filePath => {
  queue.push({ path: filePath }, () => {});
};

const pushFile = filePath => {
  const formData = {
    path: filePathUnixified(filePath), // need path with / separators
    marketplace_builder_file_body: fs.createReadStream(filePath)
  };

  return gateway.sync(formData).then(body => {
    if (body.refresh_index) {
      logger.Warn('WARNING: Data schema was updated. It will take a while for the change to be applied.');
    }

    logger.Success(`[Sync] ${filePath} - done`);
  });
};

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: program.help.bind(program) });
};

const watchDirectory = name => {
  if (fs.existsSync(name)) {
    watch(name, { recursive: true }, (event, file) => {
      shouldBeSynced(file, event) && enqueue(file);
    });
  }
};

program
  .version(version)
  .option('--email <email>', 'authentication token', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'marketplace url', process.env.MARKETPLACE_URL)
  // .option('--files <files>', 'watch files', process.env.FILES || watchFilesExtensions)
  .parse(process.argv);

checkParams(program);

const gateway = new Gateway(program);

gateway.ping().then(() => {
  if (!fs.existsSync('marketplace_builder') && !fs.existsSync('modules')) {
    logger.Error('marketplace_builder or modules directory has to exist!');
  }

  logger.Info(`Enabling sync mode to: ${program.url}`);

  watchDirectory('marketplace_builder');
  watchDirectory('modules');
});
