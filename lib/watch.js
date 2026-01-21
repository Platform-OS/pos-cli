import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import async from 'async';
import cloneDeep from 'lodash.clonedeep';
import debounce from 'lodash.debounce';
import ServerError from './ServerError.js';

import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { fillInTemplateValues } from '../lib/templates.js';
import { loadSettingsFileForModule } from '../lib/settings.js';
import dir from '../lib/directories.js';
import files from '../lib/files.js';
import livereload from 'livereload';
import watchFileExtensions from '../lib/watch-files-extensions.js';
import { manifestGenerateForAssets } from './assets/manifest.js';
import { uploadFileFormData } from './s3UploadFile.js';
import { presignDirectory } from './presignUrl.js';
import shouldBeSynced from '../lib/shouldBeSynced.js';

const filePathUnixified = filePath =>
  filePath
    .replace(/\\/g, '/')
    .replace(new RegExp(`^${dir.APP}/`), '')
    .replace(new RegExp(`^${dir.LEGACY_APP}/`), '');
const moduleAssetRegex = new RegExp('^modules/\\w+/public/assets');
let queue;
let directUploadData;
let manifestFilesToAdd = [];

const isAssetsPath = path => {
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath.startsWith('app/assets') || moduleAssetRegex.test(normalizedPath);
};
const enqueuePush = filePath => queue.push({ path: filePath, op: 'push' }, () => {});
const enqueueDelete = filePath => queue.push({ path: filePath, op: 'delete' }, () => {});

const getBody = (filePath, processTemplate) => {
  if (processTemplate) {
    const moduleTemplateData = templateData(filePath.split(path.sep)[1]);
    return fillInTemplateValues(filePath, moduleTemplateData);
  } else {
    return fs.createReadStream(filePath);
  }
};

const templateData = module => loadSettingsFileForModule(module);

const pushFile = (gateway, syncedFilePath) => {
  let filePath = filePathUnixified(syncedFilePath);
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
  }).catch(e => {
    ServerError.handler(e);
  });
};

const deleteFile = (gateway, syncedFilePath) => {
  let filePath = filePathUnixified(syncedFilePath);
  const formData = {
    path: filePath,
    primary_key: filePath
  };

  return gateway.delete(formData).then(body => {
    if (body) {
      logger.Success(`[Sync] Deleted: ${filePath}`);
    }
  });
};

const pushFileDirectAssets = (gateway, syncedFilePath) => {
  if (isAssetsPath(syncedFilePath)) {
    sendAsset(gateway, syncedFilePath);
    return Promise.resolve(true);
  } else {
    return pushFile(gateway, syncedFilePath);
  }
};

const manifestSend = debounce(
  gateway => {
    const manifest = manifestGenerateForAssets(manifestFilesToAdd.slice());
    logger.Debug(manifest);
    gateway.sendManifest(manifest);
    manifestFilesToAdd = [];
  },
  1000,
  { maxWait: 1000 * 10 }
);

const manifestAddAsset = path => manifestFilesToAdd.push(path);

const sendAsset = async (gateway, filePath) => {
  try {
    const data = cloneDeep(directUploadData);
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileSubdir = normalizedPath.startsWith('app/assets')
      ? path.dirname(normalizedPath).replace('app/assets', '')
      : '/' + path.dirname(normalizedPath).replace('/public/assets', '');
    const key = data.fields.key.replace('assets/${filename}', `assets${fileSubdir}/\${filename}`);
    data.fields.key = key;
    logger.Debug(data);
    await uploadFileFormData(filePath, data);
    manifestAddAsset(filePath);
    manifestSend(gateway);
    logger.Success(`[Sync] Synced asset: ${normalizedPath}`);
  } catch (e) {
    logger.Debug(e.message);
    logger.Debug(e.stack);
    logger.Error(`[Sync] Failed to sync: ${filePath}`);
  }
};

const fetchDirectUploadData = async gateway => {
  const instanceId = (await gateway.getInstance()).id;
  const remoteAssetsDir = `instances/${instanceId}/assets`;
  const data = await presignDirectory(remoteAssetsDir);
  directUploadData = data;
};

const start = async (env, directAssetsUpload, liveReload) => {
  // TODO: Graceful Shutdown Limitation
  //
  // ISSUE: Chokidar 5.x made watcher.close() async (returns Promise), but this function
  // does not currently return the watcher instance or provide a cleanup mechanism.
  //
  // IMPACT:
  // - File watchers are not gracefully closed when the process exits
  // - May cause file descriptor leaks in long-running processes
  // - Process must be killed with SIGTERM/SIGINT
  // - Integration tests work around this by using process.kill()
  //
  // RECOMMENDATION:
  // 1. Return the watcher instance from this function
  // 2. Add signal handlers (SIGTERM/SIGINT) in bin/pos-cli-sync.js
  // 3. Properly await watcher.close() on shutdown
  //
  // Example implementation:
  //   const watcher = chokidar.watch(...);
  //   process.on('SIGTERM', async () => {
  //     await watcher.close();
  //     process.exit(0);
  //   });
  //
  // Related: Chokidar 5.x breaking change - https://github.com/paulmillr/chokidar/releases/tag/v5.0.0

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
    liveReloadServer = livereload.createServer({
      exts: watchFileExtensions,
      delay: 250
    });

    liveReloadServer.watch(path.join(process.cwd(), '{app,modules}'));

    logger.Info('[LiveReload] Server started');
  }

  const reload = () => liveReload && liveReloadServer.refresh(program.url);

  queue = async.queue((task, callback) => {
    switch (task.op) {
      case 'push':
        push(gateway, task.path).then(reload).then(callback);
        break;
      case 'delete':
        deleteFile(gateway, task.path).then(reload).then(callback);
        break;
    }
  }, program.concurrency);

  return gateway.ping().then(() => {
    const directories = dir.toWatch();

    if (directories.length === 0) {
      logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
    }

    // NOTE: Watcher instance is not captured or returned for cleanup
    // See TODO comment at top of start() function for details about graceful shutdown limitation
    chokidar
      .watch(directories, {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        },
        ignored: [
          '**/.DS_Store'
        ]
      })
      .on('change', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('add', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('unlink', fp => shouldBeSynced(fp, ignoreList) && enqueueDelete(fp));

    logger.Info(`[Sync] Synchronizing changes to: ${program.url}`);
  });
};

export { start };
