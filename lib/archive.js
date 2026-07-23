import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import glob from 'fast-glob';

import { loadSettingsFileForModule } from './settings.js';
import logger from './logger.js';
import dir from './directories.js';
import prepareArchive from './prepareArchive.js';
import { POS_MODULE_LOCK_FILE, POS_MODULE_FILE } from './modules/paths.js';
import { resolveDeployLock } from './deploy/resolveDeployLock.js';

const isEmpty = d => shell.ls(d).length === 0;

const addModulesToArchive = async (archive, withoutAssets) => {
  if (!fs.existsSync(dir.MODULES)) {
    return [];
  }
  const modules = await glob('*', { cwd: dir.MODULES, onlyFiles: false, onlyDirectories: true });
  await Promise.all(modules.map(module => addModuleToArchive(module, archive, withoutAssets)));
  return modules;
};

const addModuleToArchive = async (module, archive, withoutAssets, pattern = '{public,private}/**') => {
  const files = await glob(pattern, {
    cwd: path.join(dir.MODULES, module),
    onlyFiles: true
  });

  const moduleTemplateData = loadSettingsFileForModule(module);

  for (const f of files) {
    if (withoutAssets && (f.startsWith('public/assets/') || f.startsWith('private/assets/'))) {
      continue;
    }
    const realPath = path.join(dir.MODULES, module, f);
    archive.appendTemplated(realPath, realPath.split(path.sep).join('/'), moduleTemplateData);
  }

  addModuleManifestToArchive(module, archive);
};

// The instance-side auto-installer that downloads a dependency missing from a deploy (see
// AppBuilder::InstanceModules::DownloadMissingModules on the backend) needs to tell "this module
// has no files at all in this deploy" apart from "this module's files are here, but stale versus
// what pos-module.lock.json declares" (e.g. a developer forgot to rerun `modules install` after
// pulling a bumped lock file) so it can warn appropriately instead of silently deploying stale
// content. That requires shipping *some* per-module version marker — this ships just the
// existing pos-module.json manifest, not the rest of the module's authoring content (generators/,
// package.json, package-lock.json, template-values.json, README, ...), which the instance has no
// use for and would otherwise show up as unmatched files in the deploy report.
const addModuleManifestToArchive = (module, archive) => {
  const manifestPath = path.join(dir.MODULES, module, POS_MODULE_FILE);
  if (!fs.existsSync(manifestPath)) return;

  archive.addFile(manifestPath, path.join('modules', module, POS_MODULE_FILE).split(path.sep).join('/'));
};

const findAppDirectory = async () => {
  let appDirectory = dir.APP;
  if (dir.toWatch().length === 0) {
    return await logger.Error(
      `Could not find any directory to deploy. Looked for ${dir.APP}, ${dir.LEGACY_APP} and ${dir.MODULES}`,
      { exit: false }
    );
  }

  if (!fs.existsSync(dir.APP) && fs.existsSync(dir.LEGACY_APP)) {
    logger.Debug(`${dir.APP} not found, but ${dir.LEGACY_APP} is present. Setting ${dir.LEGACY_APP} as app dir.`);
    logger.Warn(`Falling back to legacy app directory name. Please consider renaming ${dir.LEGACY_APP} to ${dir.APP}`);
    appDirectory = dir.LEGACY_APP;
  }
  return appDirectory;
};

const makeArchive = async (env, { withoutAssets }) => {
  const archivePath = env.TARGET || './tmp/release.zip';
  const directory = await findAppDirectory();
  if (!directory) return false;
  if (dir.available().length === 0) {
    return await logger.Error(`At least one of ${dir.ALLOWED.join(', ')} directories is needed to deploy`, {
      hideTimestamp: true,
      exit: false
    });
  }

  if (isEmpty(dir.currentApp()) && !withoutAssets) {
    return await logger.Error(
      `${dir.currentApp()} can't be empty if the deploy is not partial - it would remove all the files from the instance`,
      { hideTimestamp: true, exit: false }
    );
  }

  const archive = prepareArchive(archivePath, !withoutAssets);

  const appFiles = await glob(['**/*', '!**/*.zip'], {
    cwd: directory,
    onlyFiles: true,
    ignore: withoutAssets ? ['assets/**'] : []
  });

  for (const f of appFiles) {
    archive.addFile(path.join(directory, f), `${directory}/${f}`);
  }

  const moduleNames = await addModulesToArchive(archive, withoutAssets);

  const lock = resolveDeployLock(moduleNames);
  if (lock) {
    archive.addBuffer(Buffer.from(JSON.stringify(lock, null, 2)), POS_MODULE_LOCK_FILE);
  }

  archive.finalize();

  return archive.done;
};

export { makeArchive };
