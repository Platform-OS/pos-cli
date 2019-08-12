#!/usr/bin/env node

const fs = require('fs'),
  path = require('path');

const program = require('commander'),
  chokidar = require('chokidar'),
  Queue = require('async/queue');

const Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  validate = require('../lib/validators'),
  templates = require('../lib/templates'),
  settings = require('../lib/settings'),
  dir = require('../lib/directories');

const shouldBeSynced = require('../lib/shouldBeSynced');

const filePathUnixified = filePath =>
  filePath
    .replace(/\\/g, '/')
    .replace(new RegExp(`^${dir.APP}/`), '')
    .replace(new RegExp(`^${dir.LEGACY_APP}/`), '');

const queue = Queue((task, callback) => {
  pushFile(task.path).then(callback);
}, program.concurrency);

const enqueue = filePath => {
  queue.push({ path: filePath }, () => {});
};

const getBody = (filePath, processTemplate) => {
  if (processTemplate) {
    const moduleTemplateData = templateData(filePath.split(path.sep)[1]);
    return templates.fillInTemplateValues(filePath, moduleTemplateData);
  } else {
    return fs.createReadStream(filePath);
  }
};

const templateData = module => {
  return settings.loadSettingsFileForModule(module);
};

const pushFile = syncedFilePath => {
  let filePath = filePathUnixified(syncedFilePath); // need path with / separators

  const formData = {
    path: filePath,
    marketplace_builder_file_body: getBody(syncedFilePath, filePath.startsWith('modules'))
  };

  return gateway
    .sync(formData)
    .then(body => {
      if (body && body.refresh_index) {
        logger.Warn('[Sync] WARNING: Data schema was updated. It will take a while for the change to be applied.');
      }

      if (body) {
        logger.Success(`[Sync] Synced: ${filePath}`);
      }
    });
};

const checkParams = params => {
  validate.existence({ argumentValue: params.token, argumentName: 'token', fail: program.help.bind(program) });
  validate.existence({ argumentValue: params.url, argumentName: 'URL', fail: program.help.bind(program) });
};

program
  .option('--email <email>', 'authentication token', process.env.MARKETPLACE_EMAIL)
  .option('--token <token>', 'authentication token', process.env.MARKETPLACE_TOKEN)
  .option('--url <url>', 'application url', process.env.MARKETPLACE_URL)
  .option('-c --concurrency <number>', 'maximum concurrent connections to the server', process.env.CONCURRENCY)
  .parse(process.argv);

checkParams(program);

const gateway = new Gateway(program);

gateway.ping().then(() => {
  const directories = dir.toWatch();

  if (directories.length === 0) {
    logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
  }

  chokidar
    .watch(directories, {
      ignoreInitial: true
    })
    .on('change', fp => shouldBeSynced(fp) && enqueue(fp))
    .on('add', fp => shouldBeSynced(fp) && enqueue(fp));

  logger.Info(`Synchronizing changes to: ${program.url}`);
});
