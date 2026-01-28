import fs from 'fs';
import shell from 'shelljs';
import glob from 'fast-glob';

import { fillInTemplateValues } from './templates.js';
import logger from './logger.js';
import { loadSettingsFileForModule } from './settings.js';
import dir from './directories.js';
import prepareArchive from './prepareArchive.js';

const isEmpty = dir => shell.ls(dir).length == 0;

const addModulesToArchive = async (archive, withoutAssets) => {
  if (!fs.existsSync(dir.MODULES)) {
    return Promise.resolve(true);
  }
  const modules = await glob('*', { cwd: dir.MODULES, onlyFiles: false });
  return Promise.all(modules.map(module => addModuleToArchive(module, archive, withoutAssets)));
};

const addModuleToArchive = (module, archive, withoutAssets, pattern = '**/{private,public}/**') => {
  return new Promise((resolve, _reject) => {
    glob(pattern, {
      cwd: `${dir.MODULES}/${module}`,
      filesOnly: true
    })
      .then(files => {
        const moduleTemplateData = loadSettingsFileForModule(module);

        return Promise.all(
          files
            .filter(file => {
              return !withoutAssets || !(file.startsWith('public/assets/') || file.startsWith('private/assets'));
            })
            .map(f => {
              const path = `${dir.MODULES}/${module}/${f}`;
              return new Promise((resolve, _reject) => {
                fs.lstat(path, (err, stat) => {
                  if (!stat.isDirectory()) {
                    const filledTemplate = fillInTemplateValues(path, moduleTemplateData);
                    archive.append(filledTemplate, { name: path });
                  }
                  resolve();
                });
              });
            })
        ).then(() => resolve());
      })
      .catch(async e => {
        await logger.Error(e);
      });
  });
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
  const path = env.TARGET || './tmp/release.zip';
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
  const options = {
    cwd: directory,
    ignore: withoutAssets ? ['assets/**'] : []
  };

  return new Promise((resolve, _reject) => {
    const runArchive = async () => {
      const releaseArchive = prepareArchive(path, resolve, !withoutAssets);
      releaseArchive.glob('**/!(*.zip)*', options, { prefix: directory });
      await addModulesToArchive(releaseArchive, withoutAssets);
      await releaseArchive.finalize();
    };
    runArchive();
  });
};

export { makeArchive };
