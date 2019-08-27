const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const Queue = require('async/queue');

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
let queue;

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

const pushFile = (gateway, syncedFilePath) => {
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

const start = async(env) => {
  const program = {
    email: env.MARKETPLACE_EMAIL,
    token: env.MARKETPLACE_TOKEN,
    url: env.MARKETPLACE_URL,
    concurrency: env.CONCURRENCY
  };
  const gateway = new Gateway(program);
  queue = Queue((task, callback) => {
    pushFile(gateway, task.path).then(callback);
  }, program.concurrency);

  return gateway.ping().then(() => {
    const directories = dir.toWatch();

    if (directories.length === 0) {
      logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
    }

    chokidar
      .watch(directories, { ignoreInitial: true })
      .on('change', fp => shouldBeSynced(fp) && enqueue(fp))
      .on('add', fp => shouldBeSynced(fp) && enqueue(fp));

    logger.Info(`Synchronizing changes to: ${program.url}`);
  });
};

module.exports = {
  start: start
};
