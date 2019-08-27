const fs = require('fs');
const shell = require('shelljs');
const glob = require('tiny-glob');

const templates = require('../lib/templates');
const logger = require('../lib/logger');
const settings = require('../lib/settings');
const dir = require('../lib/directories');
const prepareArchive = require('../lib/prepareArchive');

const isEmpty = dir => shell.ls(dir).length == 0;

const addModulesToArchive = async archive => {
  if (!fs.existsSync(dir.MODULES)) {
    return Promise.resolve(true);
  }

  const modules = await glob('./*', { cwd: dir.MODULES });
  return Promise.all(modules.map(module => addModuleToArchive(module, archive)));
};

// https://github.com/terkelg/tiny-glob/issues/28 - a little bit sad.
const addModuleToArchive = (module, archive, pattern = '**/{private,public}/**') => {
  return new Promise((resolve, reject) => {
    glob(pattern, { cwd: `${dir.MODULES}/${module}`, filesOnly: true }).then(files => {
      const moduleTemplateData = settings.loadSettingsFileForModule(module);

      return Promise.all(
        files.map(f => {
          const path = `${dir.MODULES}/${module}/${f}`;
          return new Promise((resolve, reject) => {
            fs.lstat(path, (err, stat) => {
              if (!stat.isDirectory()) {
                const filledTemplate = templates.fillInTemplateValues(path, moduleTemplateData);
                archive.append(filledTemplate, {
                  name: path
                });
              }
              resolve();
            });
          });
        })
      ).then(() => resolve());
    }).catch(e => {
      logger.Debug(e);
    });
  });
};

const findAppDirectory = () => {
  let appDirectory = dir.APP;
  if (dir.toWatch().length === 0) {
    return logger.Error(`Could not find any directory to deploy. Looked for ${dir.APP}, ${dir.LEGACY_APP} and ${dir.MODULES}`, { exit: false });
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
  const directory = findAppDirectory();
  if (!directory) return false;
  if (dir.available().length === 0) {
    return logger.Error(`At least one of ${dir.ALLOWED.join(', ')} directories is needed to deploy`, { hideTimestamp: true, exit: false });
  }

  if (isEmpty(dir.currentApp()) && !withoutAssets) {
    return logger.Error(
      `${dir.currentApp()} can't be empty if the deploy is not partial - it would remove all the files from the instance`,
      { hideTimestamp: true, exit: false }
    );
  }
  const options = {
    cwd: directory,
    ignore: withoutAssets ? ['assets/**'] : []
  };

  return new Promise(async (resolve, reject) => {
    const releaseArchive = prepareArchive(path, resolve, !withoutAssets);
    releaseArchive.glob('**/*', options, { prefix: directory });
    await addModulesToArchive(releaseArchive);
    await releaseArchive.finalize();
  });
};

module.exports = {
  makeArchive: makeArchive
};
