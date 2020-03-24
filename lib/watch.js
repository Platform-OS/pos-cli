const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const Queue = require('async/queue');
const cloneDeep = require('lodash.clonedeep');
const debounce = require('lodash.debounce');

const Gateway = require('../lib/proxy'),
  logger = require('../lib/logger'),
  templates = require('../lib/templates'),
  settings = require('../lib/settings'),
  dir = require('../lib/directories'),
  files = require('../lib/files'),
  livereload = require('livereload'),
  manifestGenerateForAssets = require('./assets/manifest').manifestGenerateForAssets,
  uploadFileFormData = require('./s3UploadFile').uploadFileFormData,
  presignDirectory = require('./presignUrl').presignDirectory,
  shouldBeSynced = require('../lib/shouldBeSynced');

const filePathUnixified = filePath =>
  filePath
    .replace(/\\/g, '/')
    .replace(new RegExp(`^${dir.APP}/`), '')
    .replace(new RegExp(`^${dir.LEGACY_APP}/`), '');
const moduleAssetRegex = new RegExp('^modules/\\w+/public/assets');
let queue;
let directUploadData;
let manifestFilesToAdd = [];

const isAssetsPath = (path) => path.startsWith('app/assets') || moduleAssetRegex.test(path);
const enqueuePush = (filePath) => queue.push({ path: filePath, op: "push" }, () => { });
const enqueueDelete = (filePath) => queue.push({ path: filePath, op: "delete" }, () => { });

const getBody = (filePath, processTemplate) => {
  if (processTemplate) {
    const moduleTemplateData = templateData(filePath.split(path.sep)[1]);
    return templates.fillInTemplateValues(filePath, moduleTemplateData);
  } else {
    return fs.createReadStream(filePath);
  }
};

const templateData = (module) => settings.loadSettingsFileForModule(module);

const pushFile = (gateway, syncedFilePath) => {
  let filePath = filePathUnixified(syncedFilePath); // need path with / separators
  const formData = {
    path: filePath,
    marketplace_builder_file_body: getBody(syncedFilePath, filePath.startsWith('modules'))
  };

  return gateway.sync(formData).then(body => {
    if (body && body.refresh_index) {
      logger.Warn('[Sync] WARNING: Data schema was updated. It will take a while for the change to be applied.');
    }

    if (body) {
      logger.Success(`[Sync] Synced: ${filePath}`);
    }
  });
};

const deleteFile = (gateway, syncedFilePath) => {
  let filePath = filePathUnixified(syncedFilePath); // need path with / separators
  const formData = {
    path: filePath,
    primary_key: filePath,
  };

  return gateway.delete(formData).then(body => {
    if (body) {
      logger.Info(`[Sync] Deleted: ${filePath}`);
    }
  });
};

const pushFileDirectAssets = (gateway, syncedFilePath) => {
  if (isAssetsPath(syncedFilePath)){
    sendAsset(gateway, syncedFilePath)
    return Promise.resolve(true);
  } else {
    return pushFile(gateway, syncedFilePath);
  }
};

const manifestSend = debounce(
  (gateway) => {
    const manifest = manifestGenerateForAssets(manifestFilesToAdd.slice());
    logger.Debug(manifest);
    gateway.sendManifest(manifest);
    manifestFilesToAdd = [];
  },
  1000,
  { maxWait: 1000 * 10 }
);

const manifestAddAsset = (path) => manifestFilesToAdd.push(path);

const sendAsset = async (gateway, filePath) => {
  try {
    const data = cloneDeep(directUploadData);
    const fileSubdir = filePath.startsWith('app/assets') ? path.dirname(filePath).replace('app/assets','') : '/' + path.dirname(filePath).replace('/public/assets', '');
    const key = data.fields.key.replace('assets/${filename}', `assets${fileSubdir}/\${filename}`)
    data.fields.key = key;
    logger.Debug(data);
    await uploadFileFormData(filePath, data);
    manifestAddAsset(filePath);
    manifestSend(gateway);
    logger.Success(`[Sync] Synced asset: ${filePath}`);
  } catch (e) {
    logger.Debug(e.message);
    logger.Debug(e.stack);
    logger.Error(`[Sync] Failed to sync: ${filePath}`);
  }
}

const fetchDirectUploadData = async (gateway) => {
  const instanceId = (await gateway.getInstance()).id;
  const remoteAssetsDir = `instances/${instanceId}/assets`;
  const data = await presignDirectory(remoteAssetsDir);
  directUploadData = data;
}

const start = async (env, directAssetsUpload, liveReload) => {
  const program = {
    email: env.MARKETPLACE_EMAIL,
    token: env.MARKETPLACE_TOKEN,
    url: env.MARKETPLACE_URL,
    concurrency: env.CONCURRENCY
  };
  const gateway = new Gateway(program);
  const ignoreList = files.getIgnoreList();
  const push = directAssetsUpload ? pushFileDirectAssets : pushFile;
  if (directAssetsUpload) await fetchDirectUploadData(gateway);

  let liveReloadServer;
  if (liveReload) {
    liveReloadServer = livereload.createServer();
  }

  const reload = () => {
    if (liveReload) {
      logger.Info(`[LiveReload] Refreshing ${program.url}`)
      liveReloadServer.refresh(program.url);
    }
  }

  queue = Queue((task, callback) => {
    switch (task.op) {
      case "push":
        push(gateway, task.path).then(reload).then(callback);
        break;
      case "delete":
        deleteFile(gateway, task.path).then(reload).then(callback);
        break;
    }
  }, program.concurrency);

  return gateway.ping().then(() => {
    const directories = dir.toWatch();

    if (directories.length === 0) {
      logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
    }

    chokidar
      .watch(directories, { ignoreInitial: true })
      .on('change', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('add', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('unlink', fp => shouldBeSynced(fp, ignoreList) && enqueueDelete(fp));

    logger.Info(`Synchronizing changes to: ${program.url}`);
  });
};

module.exports = {
  start: start
};
