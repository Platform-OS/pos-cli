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

const availableDirectories = () => dir.ALLOWED.filter(fs.existsSync);
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

const makeArchive = (path, directory, withoutAssets) => {
  if (availableDirectories().length === 0) {
    logger.Error(`At least one of ${dir.ALLOWED} directories is needed to deploy`, { hideTimestamp: true });
  }

  availableDirectories().map(dir => {
    if (isEmpty(dir) && !withoutAssets) {
      logger.Error(
        `${dir} can't be empty if the deploy is not partial - it would remove all the files from the instance`,
        { hideTimestamp: true }
      );
    }
  });

  const releaseArchive = prepareArchive(path, !program.withoutAssets);

  const options = {
    cwd: directory,
    ignore: withoutAssets ? ['assets/**'] : []
  };

  releaseArchive.glob('**/*', options, { prefix: directory });

  addModulesToArchive(releaseArchive).then(r => {
    releaseArchive.finalize();
  });
};

program
  .option('--without-assets', 'if present assets directory will be excluded')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

let appDirectory = dir.APP;

if (!fs.existsSync(dir.APP) && !fs.existsSync(dir.LEGACY_APP)) {
  logger.Error('Could not find app directory.');
}

if (fs.existsSync(dir.LEGACY_APP)) {
  logger.Debug(`${dir.APP} not found, but ${dir.LEGACY_APP} is present. Setting ${dir.LEGACY_APP} as app dir.`);
  logger.Warn(`Falling back to legacy app-directory name. Please consider renaming ${dir.LEGACY_APP} to ${dir.APP}`);
  appDirectory = dir.LEGACY_APP;
}

makeArchive(program.target, appDirectory, program.withoutAssets);
