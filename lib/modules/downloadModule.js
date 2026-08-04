import logger from '../logger.js';
import downloadFile from '../downloadFile.js';
import { unzip } from '../unzip.js';
import Portal from '../portal.js';
import fs from 'fs';
import path from 'path';
import { getModulePath, POS_MODULE_FILE, TEMPLATE_VALUES_FILE } from './paths.js';
import { createStagingDir, clearStagingBase } from './staging.js';
import { safeReadFile } from './postInstall.js';

/** Name the downloaded archive gets inside the module's own staging directory. */
const ARCHIVE_FILE = 'archive.zip';

/**
 * Checks that a freshly extracted staging directory contains the expected
 * `<moduleName>/` root, and fails loudly when it does not.
 *
 * Without this check a mismatched archive silently wipes `modules/<moduleName>`
 * (it is replaced by whatever directory the archive did contain) while the command
 * still reports success.
 */
const verifyStagedModule = (moduleName, version, stagingDir) => {
  const extracted = fs.readdirSync(stagingDir).filter(entry => entry !== ARCHIVE_FILE);

  if (!extracted.includes(moduleName)) {
    const detail = extracted.length > 0 ? `archive contains: ${extracted.join(', ')}` : 'the archive is empty';
    throw new Error(`archive does not contain a "${moduleName}/" directory (${detail})`);
  }

  // A module whose own manifest disagrees with the version it was published under
  // is installed anyway (the registry version is authoritative), but it is worth
  // surfacing: readInstalledVersion will keep flagging it as stale on every run.
  const stagedVersion = readVersionFromDir(path.join(stagingDir, moduleName));
  if (stagedVersion && stagedVersion !== version) {
    logger.Warn(
      `${moduleName}: published as ${version} but its manifest declares ${stagedVersion}. ` +
      `The module will be re-downloaded on every install until the two agree.`
    );
  }
};

/**
 * Publishes a verified, fully extracted module to `modules/<moduleName>` with two renames:
 * the old tree moves aside into the staging directory, then the staged tree takes its place.
 *
 * The old tree has to leave wholesale rather than be written over, because a file deleted
 * between the two versions would otherwise survive the update. And only the second rename
 * publishes anything, so an interrupted swap leaves either the old module or none at all —
 * never a half-written tree whose manifest already claims the new version, which
 * modulesNotOnDisk would then treat as up-to-date forever.
 *
 * The displaced copy stays inside `stagingDir` so the caller's cleanup removes it along
 * with everything else, rather than needing its own cleanup path.
 */
const swapIntoPlace = async (moduleName, stagingDir) => {
  const stagedPath = path.join(stagingDir, moduleName);
  const modulePath = getModulePath(moduleName);
  const backupPath = path.join(stagingDir, `old-${moduleName}`);

  await fs.promises.mkdir(path.dirname(modulePath), { recursive: true });
  const hadPrevious = fs.existsSync(modulePath);
  if (hadPrevious) await fs.promises.rename(modulePath, backupPath);

  try {
    await fs.promises.rename(stagedPath, modulePath);
  } catch (error) {
    // Best effort: a failed rollback must not mask why the swap failed. Worst case the
    // module is left absent, which the next run re-downloads.
    if (hadPrevious) await fs.promises.rename(backupPath, modulePath).catch(() => {});
    throw error;
  }
};

/**
 * Downloads a single module archive and installs it atomically.
 *
 * @param {string} moduleName    Module name (e.g. "core").
 * @param {string} version       Exact version to download.
 * @param {string} [registryUrl] Registry URL for the download request.
 */
const downloadModule = async (moduleName, version, registryUrl) => {
  const moduleWithVersion = `${moduleName}@${version}`;
  let stagingDir;

  try {
    logger.Info(`Downloading ${moduleWithVersion}...`);
    const moduleVersion = await Portal.moduleVersionsSearch(moduleWithVersion, registryUrl);
    // Archive and extraction both live in the staging directory, so `modules/<name>` is
    // only touched once a complete, verified copy is ready to swap in — and one cleanup
    // covers both.
    stagingDir = await createStagingDir(moduleName);
    const archive = path.join(stagingDir, ARCHIVE_FILE);
    await downloadFile(moduleVersion['public_archive'], archive);
    await unzip(archive, stagingDir);
    verifyStagedModule(moduleName, version, stagingDir);
    await swapIntoPlace(moduleName, stagingDir);
  } catch (error) {
    throw new Error(`${moduleWithVersion}: ${error.statusCode === 404 ? '404 not found' : error.message}`);
  } finally {
    if (stagingDir) await fs.promises.rm(stagingDir, { recursive: true, force: true });
  }
};

/**
 * Downloads every module in `modules` concurrently.
 *
 * Uses allSettled rather than Promise.all so a single failure never leaves sibling
 * downloads running unsupervised — reporting failure while other modules are still being
 * replaced on disk means a Ctrl-C at that prompt can leave one half-installed. All
 * failures are collected and reported together.
 *
 * @param {Object}   modules        { name: version } map of modules to download.
 * @param {Function} getRegistryUrl (name) => registryUrl — called per module so each
 *                                  can be fetched from its own registry.
 */
const downloadAllModules = async (modules, getRegistryUrl) => {
  const settled = await Promise.allSettled(
    Object.entries(modules).map(([moduleName, version]) =>
      downloadModule(moduleName, version, getRegistryUrl(moduleName))
    )
  );

  // Best effort: also clears staging leftovers from a previously killed run. Safe here
  // because every download of this run has settled.
  await clearStagingBase();

  const failures = settled.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    const messages = failures.map(f => f.reason?.message ?? String(f.reason));
    throw new Error(
      failures.length === 1
        ? messages[0]
        : `Failed to download ${failures.length} modules:\n  ${messages.join('\n  ')}`
    );
  }
};

const readJsonVersion = (filePath) => safeReadFile(filePath, (raw) => JSON.parse(raw).version ?? null);

/**
 * Reads the `version` recorded in a module directory's own manifest: pos-module.json,
 * falling back to template-values.json for modules published before the pos-module.json
 * convention existed (many currently-published registry modules still ship this way).
 * Returns null when neither file exists, is readable, or carries a `version` field.
 */
const readVersionFromDir = (dir) =>
  readJsonVersion(path.join(dir, POS_MODULE_FILE)) ?? readJsonVersion(path.join(dir, TEMPLATE_VALUES_FILE));

/** The same, for an installed module: `modules/<name>`. null means "not installed". */
const readInstalledVersion = (name) => readVersionFromDir(getModulePath(name));

/**
 * Returns the subset of modules whose installed disk version does not match
 * the target version — including modules missing from disk entirely. Used by
 * --frozen mode (and smartInstall's fast path) where the lock is already the
 * source of truth and there is no "previous lock" to compare versions against.
 *
 * Checking installed disk version rather than mere directory presence catches
 * modules whose directory exists but whose contents are stale — e.g. deleted
 * manually then recreated empty, or simply never updated after the lock file
 * itself was bumped (by a teammate, a merge, etc.) without the module directory
 * being refreshed locally.
 *
 * Note this can only detect staleness a module's own manifest admits to. Keeping
 * installs atomic (see swapIntoPlace) is what guarantees a directory's contents
 * actually match the version its manifest reports.
 */
const modulesNotOnDisk = (modules) =>
  Object.fromEntries(
    Object.entries(modules).filter(([name, version]) => readInstalledVersion(name) !== version)
  );

/**
 * Returns the subset of modulesLocked that actually needs to be downloaded:
 * everything modulesNotOnDisk flags, plus any module whose version in
 * previousLock no longer matches the newly resolved version.
 */
const modulesToDownload = (modulesLocked, previousLock) => ({
  ...Object.fromEntries(
    Object.entries(modulesLocked).filter(([name, version]) => previousLock[name] !== version)
  ),
  ...modulesNotOnDisk(modulesLocked),
});

export {
  downloadModule,
  downloadAllModules,
  modulesToDownload,
  modulesNotOnDisk,
  readInstalledVersion,
};
