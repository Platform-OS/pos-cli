#!/usr/bin/env node

const APP_DIR = 'app';
const LEGACY_APP_DIR = 'marketplace_builder';
const MODULES_DIR = 'modules';
const program = require('commander'),
  fs = require('fs'),
  paths = require('path'),
  shell = require('shelljs'),
  glob = require('glob'),
  archiver = require('archiver'),
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

const addModuleToArchive = (module, archive) => {
  return new Promise((resolve, reject) => {
    glob('?(public|private)/**', { cwd: `${MODULES_DIR}/${module}` }, (err, files) => {
      if (err) throw reject(err);
      const moduleTemplateData = templateData(`${MODULES_DIR}/${module}/template-values.json`);

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
      logger.Error(`${dir} can't be empty if the deploy is not partial - it would remove all the files from the instance`, {
        hideTimestamp: true
      });
    }
  });

  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);

  const output = fs.createWriteStream(path);
  const archive = archiver('zip', { zlib: { level: 6 } });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', () => {
    const sizeInMB = archive.pointer() / 1024 / 1024;
    logger.Info(`Archive size: ${sizeInMB.toFixed(2)} MB`);
  });

  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      logger.Error(err);
    } else throw err;
  });

  archive.on('error', err => {
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  let options = { cwd: directory };
  if (withoutAssets) options.ignore = ['assets/**'];

  archive.glob('**/*', options, { prefix: directory });

  addModulesToArchive(archive).then(r => {
    archive.finalize();
  });
};

const templateData = (path) => {
  return settings.loadSettingsFile(path);
};

program
  .version(version)
  .option('--without-assets', 'if present assets directory will be excluded')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

if (fs.existsSync(APP_DIR)) {
  app_directory = APP_DIR;
} else {
  console.log(`Falling back to legacy app-directory name. Please consinder renaming ${LEGACY_APP_DIR} to ${APP_DIR}`);
  app_directory = LEGACY_APP_DIR;
}

makeArchive(program.target, app_directory, program.withoutAssets);
