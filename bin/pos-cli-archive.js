#!/usr/bin/env node

const fs = require('fs');

const program = require('commander'),
  shell = require('shelljs'),
  glob = require('glob');

const templates = require('../lib/templates'),
  logger = require('../lib/logger'),
  settings = require('../lib/settings'),
  dir = require('../lib/directories');

const prepareArchive = require('../lib/prepareArchive');

const isEmpty = dir => shell.ls(dir).length == 0;

const addModulesToArchive = archive => {
  if (!fs.existsSync(dir.MODULES)) return Promise.resolve(true);

  return Promise.all(glob.sync('*/', { cwd: dir.MODULES }).map(module => addModuleToArchive(module, archive)));
};

const addModuleToArchive = (module, archive, pattern = '?(public|private)/**') => {
  return new Promise((resolve, reject) => {
    glob(pattern, { cwd: `${dir.MODULES}/${module}` }, (err, files) => {
      if (err) throw reject(err);
      const moduleTemplateData = settings.loadSettingsFileForModule(module);

      return Promise.all(
        files.map(f => {
          const path = `${dir.MODULES}/${module}/${f}`;
          return new Promise((resolve, reject) => {
            fs.lstat(path, (err, stat) => {
              if (!stat.isDirectory()) {
                archive.append(templates.fillInTemplateValues(path, moduleTemplateData), {
                  name: path
                });
              }
              resolve();
            });
          });
        })
      ).then(r => resolve());
    });
  });
};

program
  .option('--without-assets', 'if present assets directory will be excluded')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

let appDirectory = dir.APP;

if (dir.toWatch().length === 0) {
  logger.Error(`Could not find any directory to deploy. Looked for ${dir.APP}, ${dir.LEGACY_APP} and ${dir.MODULES}`);
}

if (!fs.existsSync(dir.APP) && fs.existsSync(dir.LEGACY_APP)) {
  logger.Debug(`${dir.APP} not found, but ${dir.LEGACY_APP} is present. Setting ${dir.LEGACY_APP} as app dir.`);
  logger.Warn(`Falling back to legacy app directory name. Please consider renaming ${dir.LEGACY_APP} to ${dir.APP}`);
  appDirectory = dir.LEGACY_APP;
}

const makeArchive = (path, directory, withoutAssets) => {
  if (dir.available().length === 0) {
    logger.Error(`At least one of ${dir.ALLOWED.join(', ')} directories is needed to deploy`, { hideTimestamp: true });
  }

  if (isEmpty(dir.currentApp()) && !withoutAssets) {
    logger.Error(
      `${dir.currentApp()} can't be empty if the deploy is not partial - it would remove all the files from the instance`,
      { hideTimestamp: true }
    );
  }

  const releaseArchive = prepareArchive(path, !program.withoutAssets);

  const options = {
    cwd: directory,
    ignore: withoutAssets ? ['assets/**'] : []
  };

  releaseArchive.glob('**/*', options, { prefix: directory });

  addModulesToArchive(releaseArchive)
    .then(() => {
      releaseArchive.finalize();
    })
    .catch(e => logger.Debug(e));
};

makeArchive(program.target, appDirectory, program.withoutAssets);
