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

// Custom error class to indicate an error has already been logged
class AlreadyLoggedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlreadyLoggedError';
    this.alreadyLogged = true;
  }
}

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

const pushFile = async (gateway, syncedFilePath) => {
  let filePath = filePathUnixified(syncedFilePath);
  const formData = {
    path: filePath,
    marketplace_builder_file_body: getBody(syncedFilePath, filePath.startsWith('modules'))
  };

  try {
    const body = await gateway.sync(formData);
    if (body && body.refresh_index) {
      logger.Warn('[Sync] WARNING: Data schema was updated. It will take a while for the change to be applied.');
    }

    if (body) {
      logger.Success(`[Sync] Synced: ${filePath}`);
    }
  } catch (e) {
    // Handle validation errors (422) with custom formatting
    if (e.statusCode === 422 && e.response && e.response.body) {
      const body = e.response.body;
      const error = body.error || (body.errors && body.errors.join(', '));
      if (error) {
        await logger.Error(`[Sync] Failed to sync: ${filePath}\n${error}`, { exit: false, notify: false });
        throw new AlreadyLoggedError(error);
      }
    }
    // For other errors, use the default handler
    await ServerError.handler(e);
  }
};

const deleteFile = async (gateway, syncedFilePath) => {
  const filePath = filePathUnixified(syncedFilePath);
  const formData = {
    path: filePath,
    primary_key: filePath
  };

  try {
    const body = await gateway.delete(formData);
    if (body) {
      logger.Success(`[Sync] Deleted: ${filePath}`);
    }
  } catch (e) {
    if (e.statusCode === 422 && e.response && e.response.body) {
      const body = e.response.body;
      const error = body.error || (body.errors && body.errors.join(', '));
      if (error) {
        await logger.Error(`[Sync] Failed to delete: ${filePath}\n${error}`, { exit: false, notify: false });
        throw new AlreadyLoggedError(error);
      }
    }
    await ServerError.handler(e);
  }
};

const pushFileDirectAssets = async (gateway, syncedFilePath) => {
  if (isAssetsPath(syncedFilePath)) {
    await sendAsset(gateway, syncedFilePath);
    return true;
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
    if (ServerError.isNetworkError(e)) {
      await logger.Error(`[Sync] Failed to sync: ${filePath}`);
      await ServerError.handler(e);
    } else {
      await logger.Error(`[Sync] Failed to sync ${filePath}: ${e.message || e}`);
    }
  }
};

const fetchDirectUploadData = async gateway => {
  const instanceId = (await gateway.getInstance()).id;
  const remoteAssetsDir = `instances/${instanceId}/assets`;
  const data = await presignDirectory(remoteAssetsDir);
  directUploadData = data;
};

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
        push(gateway, task.path)
          .then(reload)
          .then(callback)
          .catch(() => callback());
        break;
      case 'delete':
        deleteFile(gateway, task.path).then(reload).then(callback).catch(() => callback());
        break;
    }
  }, program.concurrency);

  return gateway.ping().then(async () => {
    const directories = dir.toWatch();

    if (directories.length === 0) {
      await logger.Error(`${dir.APP} or ${dir.MODULES} directory has to exist!`);
    }

    const watcher = chokidar
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
      .on('ready', () => logger.Info(`[Sync] Synchronizing changes to: ${program.url}`))
      .on('change', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('add', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
      .on('unlink', fp => shouldBeSynced(fp, ignoreList) && enqueueDelete(fp));

    return { watcher, liveReloadServer };
  });
};

const setupGracefulShutdown = ({ watcher, liveReloadServer, context = 'Sync' }) => {
  let isShuttingDown = false;

  const gracefulShutdown = async (signal) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.Info(`\n[${context}] Received ${signal}, shutting down gracefully...`);

    try {
      if (watcher) {
        await watcher.close();
        logger.Debug(`[${context}] File watcher closed`);
      }

      if (liveReloadServer) {
        liveReloadServer.close();
        logger.Debug(`[${context}] LiveReload server closed`);
      }

      process.exit(0);
    } catch (error) {
      logger.Error(`[${context}] Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  // Handle SIGINT (Ctrl+C) and SIGTERM on all platforms
  // Note: These handlers work correctly when users press Ctrl+C in the terminal
  // However, on Windows, child.kill('SIGINT') in tests cannot trigger these handlers
  // due to Windows' lack of POSIX signal support for individual child processes
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

const sendFile = async (gateway, filePath) => {
  await fetchDirectUploadData(gateway);
  await pushFileDirectAssets(gateway, filePath);

  // If it was an asset file, we need to flush the manifest immediately
  // since we're not in watch mode with debouncing
  if (isAssetsPath(filePath) && manifestFilesToAdd.length > 0) {
    const manifest = manifestGenerateForAssets(manifestFilesToAdd.slice());
    logger.Debug(manifest);
    await gateway.sendManifest(manifest);
    manifestFilesToAdd = [];
  }
};

export { start, setupGracefulShutdown, sendFile, pushFile, deleteFile };
