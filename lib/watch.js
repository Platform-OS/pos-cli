import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import async from 'async';
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

// Report a sync failure without killing the process, then throw so callers know
// it was already logged — watch mode's queue continues, sync -f exits non-zero.
const failSync = async (logMessage, errorMessage = logMessage) => {
  await logger.Error(logMessage, { exit: false, notify: false });
  throw new AlreadyLoggedError(errorMessage);
};

const filePathUnixified = filePath =>
  filePath
    .replace(/\\/g, '/')
    .replace(new RegExp(`^${dir.APP}/`), '')
    .replace(new RegExp(`^${dir.LEGACY_APP}/`), '');
// Module directory names are arbitrary and hyphens are common ("common-styling"),
// but `\w+` matched neither hyphens nor dots. Those modules' assets were therefore
// not recognized as assets at all and went out through pushFile as ordinary code
// files, which does not preserve them byte for byte and leaves their Content-Type
// to be derived remotely instead of sent with the upload — silently breaking .js
// and .css. `[^/]+` accepts the same module names as deploy's
// `modules/*/{private,public}/assets/**` glob and shouldBeSynced's
// `^modules/.*/(public|private)`, so a file is now classified the same way
// whichever command sends it.
const moduleAssetRegex = /^modules\/[^/]+\/public\/assets\//;

// Paths that must never be watched. chokidar v4+ dropped fsevents, so on macOS
// each watched directory costs one file descriptor (kqueue). Pruning these keeps
// pos-cli well under the OS limit and avoids EMFILE on large projects. None of
// these are ever synced, so ignoring them is safe.
//
// Matches `node_modules` or `.git` as a full path segment, or a `.DS_Store`
// basename. A single precomputed regex avoids allocating a split array on every
// call — and watchIgnored runs once per path chokidar traverses (the very
// large-tree scenario this exists to tame).
const WATCH_IGNORED_RE = /(^|\/)(node_modules|\.git)(\/|$)|(^|\/)\.DS_Store$/;

// chokidar v4+ removed glob support: a string matcher is compared literally, so
// the old `ignored: ['**/.DS_Store']` silently stopped excluding anything. The
// supported form is a function `(path, stats?) => boolean` testing the full path.
const watchIgnored = filePath => WATCH_IGNORED_RE.test(filePath.replace(/\\/g, '/'));

// Without this handler an EMFILE (too many open files) — emitted by chokidar as
// an 'error' event — becomes an uncaught error and crashes pos-cli. Keep the
// process alive and tell the user how to recover.
const handleWatcherError = async error => {
  const code = error && error.code;
  if (code === 'EMFILE' || code === 'ENFILE' || code === 'ENOSPC') {
    await logger.Error(
      `[Sync] The OS file-watch limit was reached (${code}).\n` +
        `pos-cli watches one file descriptor per directory, and very large projects can exceed the default limit.\n` +
        `Raise it (e.g. "ulimit -n 10240" on macOS/Linux) or exclude large directories via .posignore, then restart sync.`,
      { exit: false, notify: false }
    );
  } else {
    await logger.Error(`[Sync] File watcher error: ${(error && error.message) || error}`, {
      exit: false,
      notify: false
    });
  }
};

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
        await failSync(`[Sync] Failed to sync: ${filePath}\n${error}`, error);
      }
    }
    // Network connection errors should not kill sync — it may be a transient failure
    if (e.name === 'RequestError') {
      await failSync(`[Sync] Failed to sync: ${filePath}`, e.message);
    }
    // For HTTP status code errors, use the centralized handler
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
        await failSync(`[Sync] Failed to delete: ${filePath}\n${error}`, error);
      }
    }
    // Network connection errors should not kill sync — it may be a transient failure
    if (e.name === 'RequestError') {
      await failSync(`[Sync] Failed to delete: ${filePath}`, e.message);
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

// Register the assets uploaded since the last flush. Building the manifest reads
// each file from disk, so it can fail just like the request itself; either way the
// batch is put back so the next flush retries it — the assets are already
// uploaded, they are just not registered yet.
const sendManifestBatch = async gateway => {
  if (manifestFilesToAdd.length === 0) return;

  const batch = manifestFilesToAdd;
  manifestFilesToAdd = [];
  try {
    const manifest = manifestGenerateForAssets(batch);
    logger.Debug(manifest);
    await gateway.sendManifest(manifest);
  } catch (e) {
    manifestFilesToAdd.push(...batch);
    throw e;
  }
};

const manifestSend = debounce(
  gateway => {
    // Fires from a debounce timer, outside any request's try/catch — an error here
    // would be unhandled and kill the process. sendManifestBatch is async, so a
    // throw while building the manifest arrives as a rejection too.
    sendManifestBatch(gateway).catch(e =>
      logger.Error(`[Sync] Failed to update assets manifest: ${e.message || e}`, { exit: false, notify: false })
    );
  },
  1000,
  { maxWait: 1000 * 10 }
);

const manifestAddAsset = path => manifestFilesToAdd.push(path);

const assetUploadData = normalizedPath => {
  const fileSubdir = normalizedPath.startsWith('app/assets')
    ? path.dirname(normalizedPath).replace('app/assets', '')
    : '/' + path.dirname(normalizedPath).replace('/public/assets', '');
  const key = directUploadData.fields.key.replace('assets/${filename}', `assets${fileSubdir}/\${filename}`);
  const data = { ...directUploadData, fields: { ...directUploadData.fields, key } };
  logger.Debug(data);
  return data;
};

const uploadAsset = async (gateway, filePath, normalizedPath) => {
  const authorizationUsed = directUploadData;
  try {
    await uploadFileFormData(filePath, assetUploadData(normalizedPath));
  } catch (e) {
    // The presigned upload authorization is fetched once at sync start and
    // expires server-side; from then on every asset upload gets a 403 until
    // it is refreshed. Refresh and retry once instead of failing.
    if (e.statusCode !== 403) throw e;
    logger.Debug('[Sync] Asset upload authorization expired, refreshing it and retrying...');
    // A concurrent upload may have refreshed it already while this one was in
    // flight — then just retry with what it fetched.
    if (directUploadData === authorizationUsed) await refreshDirectUploadData(gateway);
    await uploadFileFormData(filePath, assetUploadData(normalizedPath));
  }
};

const sendAsset = async (gateway, filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');
  try {
    await uploadAsset(gateway, filePath, normalizedPath);
    manifestAddAsset(filePath);
    manifestSend(gateway);
    logger.Success(`[Sync] Synced asset: ${normalizedPath}`);
  } catch (e) {
    logger.Debug(e.message);
    logger.Debug(e.stack);
    // Network connection errors should not kill sync — it may be a transient failure
    if (e.name === 'RequestError') {
      await failSync(`[Sync] Failed to sync: ${normalizedPath}`, e.message);
    }
    // Refreshing the upload authorization talks to the API, so its failures are
    // HTTP status code errors — the centralized handler explains those (a 401
    // tells the user to refresh their token).
    if (e.name === 'StatusCodeError') {
      await ServerError.handler(e);
    }
    const message = e.message || String(e);
    // Asset upload failures must never kill watch mode — log and let the queue
    // continue; the throw lets single-file mode (sync -f) exit non-zero.
    await failSync(`[Sync] Failed to sync ${normalizedPath}: ${message}`, message);
  }
};

const fetchDirectUploadData = async gateway => {
  const instanceId = (await gateway.getInstance()).id;
  const remoteAssetsDir = `instances/${instanceId}/assets`;
  const data = await presignDirectory(remoteAssetsDir);
  directUploadData = data;
};

// The queue uploads several assets concurrently, so when the authorization
// expires they all get 403 at once — share one in-flight refresh between them.
let directUploadDataRefresh = null;
const refreshDirectUploadData = gateway => {
  directUploadDataRefresh ||= fetchDirectUploadData(gateway).finally(() => {
    directUploadDataRefresh = null;
  });
  return directUploadDataRefresh;
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

  try {
    if (directAssetsUpload) await fetchDirectUploadData(gateway);
    await gateway.ping();
  } catch (e) {
    if (ServerError.isNetworkError(e)) {
      await ServerError.handler(e);
      process.exit(1);
    }
    throw e;
  }

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
      ignored: watchIgnored
    })
    .on('error', handleWatcherError)
    .on('ready', () => logger.Info(`[Sync] Synchronizing changes to: ${program.url}`))
    .on('change', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
    .on('add', fp => shouldBeSynced(fp, ignoreList) && enqueuePush(fp))
    .on('unlink', fp => shouldBeSynced(fp, ignoreList) && enqueueDelete(fp));

  return { watcher, liveReloadServer };
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
  // since we're not in watch mode with debouncing. Unlike the debounced flush this
  // one lets the error through, so a single-file sync exits non-zero.
  if (isAssetsPath(filePath)) {
    await sendManifestBatch(gateway);
  }
};

export { start, setupGracefulShutdown, sendFile, pushFile, deleteFile, watchIgnored, handleWatcherError };
