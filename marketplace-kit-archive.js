#!/usr/bin/env node

const APP_DIR = 'app';
const LEGACY_APP_DIR = 'marketplace_builder';
const MODULES_DIR = 'modules';
const program = require('commander'),
  fs = require('fs'),
  shell = require('shelljs'),
  glob = require('glob'),
  prepareArchive = require('./lib/prepareArchive'),
  templates = require('./lib/templates'),
  logger = require('./lib/logger'),
  settings = require('./lib/settings'),
  version = require('./package.json').version;

const ALLOWED_DIRECTORIES = [APP_DIR, LEGACY_APP_DIR, MODULES_DIR];
const availableDirectories = () => ALLOWED_DIRECTORIES.filter(fs.existsSync);
const isEmpty = dir => shell.ls(dir).length == 0;

const addModulesToArchive = archive => {
  if (!fs.existsSync(MODULES_DIR)) return Promise.resolve(true);

  return Promise.all(
    glob.sync('*/', { cwd: MODULES_DIR }).map(
      module => ( addModuleToArchive(module, archive))
    )
  );
};

const addModuleToArchive = (module, archive, pattern = '?(public|private)/**') => {
  return new Promise((resolve, reject) => {
    glob(pattern, { cwd: `${MODULES_DIR}/${module}` }, (err, files) => {
      if (err) throw reject(err);
      const moduleTemplateData = templateData(module);

      return Promise.all(
        files.map(f => {
          const path = `${MODULES_DIR}/${module}/${f}`;
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
      ).then(r => {
        resolve();
      });
    });
  });
};

const makeArchive = (path, directory, withoutAssets) => {
  if (availableDirectories().length === 0) {
    logger.Error(`At least one of ${ALLOWED_DIRECTORIES} directories is needed to deploy`, { hideTimestamp: true });
  }

  availableDirectories().map(dir => {
    if (isEmpty(dir) && !withoutAssets) {
      logger.Error(`${dir} can't be empty if the deploy is not partial - it would remove all the files from the instance`,
                   { hideTimestamp: true });
    }
  });

  const releaseArchive = prepareArchive(path);
  let options = { cwd: directory };
  if (withoutAssets) options.ignore = ['assets/**'];
  releaseArchive.glob('**/*', options, { prefix: directory });

  addModulesToArchive(releaseArchive).then(r => {
    releaseArchive.finalize();
  });
};

const templateData = (module) => {
  return settings.loadSettingsFileForModule(module);
};

program
  .version(version)
  .option('--without-assets', 'if present assets directory will be excluded')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

let app_directory;
if (fs.existsSync(APP_DIR)) {
  app_directory = APP_DIR;
} else {
  console.log(`Falling back to legacy app-directory name. Please consider renaming ${LEGACY_APP_DIR} to ${APP_DIR}`);
  app_directory = LEGACY_APP_DIR;
}

makeArchive(program.target, app_directory, program.withoutAssets);
