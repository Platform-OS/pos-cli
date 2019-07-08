#!/usr/bin/env node

const program = require('commander'),
  Gateway = require('../lib/proxy'),
  fs = require('fs'),
  path = require('path'),
  watch = require('node-watch'),
  Queue = require('async/queue'),
  logger = require('../lib/logger'),
  validate = require('../lib/validators'),
  watchFilesExtensions = require('../lib/watch-files-extensions'),
  templates = require('../lib/templates'),
  settings = require('../lib/settings'),
  version = require('../package.json').version,
  dir = require('../lib/directories');

const getWatchDirectories = () => dir.ALLOWED.filter(fs.existsSync);
const ext = filePath => filePath.split('.').pop();
const filename = filePath => filePath.split(path.sep).pop();
const filePathUnixified = filePath => filePath.replace(/\\/g, '/').replace(new RegExp(`^${dir.APP}/`), '').replace(new RegExp(`^${dir.LEGACY_APP}/`), '');
const isEmpty = filePath => fs.readFileSync(filePath).toString().trim().length === 0;
const shouldBeSynced = (filePath, event) => {
  return fileUpdated(event) && extensionAllowed(filePath) && isNotHidden(filePath) && isNotEmptyYML(filePath) && isModuleFile(filePath);
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
    logger.Warn(`[Sync] Not syncing hidden file: ${filePath}`);
  }
  return !isHidden;
};

const isNotEmptyYML = filePath => {
  if (ext(filePath) === 'yml' && isEmpty(filePath)) {
    logger.Warn(`[Sync] Not syncing empty YML file: ${filePath}`);
    return false;
  }

  return true;
};

// Mdule files outside public or private folders are not synced
const isModuleFile = f => {
  let pathArray = f.split(path.sep);
  if ('modules' != pathArray[0]) {
    return true;
  }
  return ['private', 'public'].includes(pathArray[2]);
};

const CONCURRENCY = 3;

const queue = Queue((task, callback) => {
  pushFile(task.path).then(callback);
}, CONCURRENCY);

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

const templateData = (module) => {
  return settings.loadSettingsFileForModule(module);
};

const pushFile = syncedFilePath => {
  let filePath = filePathUnixified(syncedFilePath); // need path with / separators

  const formData = {
    path: filePath,
    marketplace_builder_file_body: getBody(syncedFilePath, filePath.startsWith('modules'))
  };

  return gateway.sync(formData).then(body => {
    if (body && body.refresh_index) {
      logger.Warn('WARNING: Data schema was updated. It will take a while for the change to be applied.');
    }

    logger.Success(`[Sync] ${filePath} - done`);
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

const gateway = new Gateway(program);

gateway.ping().then(() => {
  const directories = getWatchDirectories();

  if (directories.length === 0) {
    logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
  }

  logger.Info(`Enabling sync mode to: ${program.url}`);

  watch(directories, { recursive: true }, (event, filePath) => {
    shouldBeSynced(filePath, event) && enqueue(filePath);
  });
});
