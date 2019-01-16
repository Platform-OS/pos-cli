#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  paths = require('path'),
  shell = require('shelljs'),
  glob = require('glob'),
  archiver = require('archiver'),
  templates = require('./lib/templates'),
  logger = require('./lib/logger'),
  version = require('./package.json').version;

const ALLOWED_DIRECTORIES = ['marketplace_builder', 'modules'];
const availableDirectories = () => ALLOWED_DIRECTORIES.filter(fs.existsSync);
const isEmpty = dir => shell.ls(dir).length == 0;

const fillTemplatesAndAddModulesToArchive = archive => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync('modules')) return resolve(true);

    glob('*/+(public|private)/**', { cwd: 'modules/' }, (err, files) => {
      if (err) throw reject(err);
      for (f of files) {
        const path = `modules/${f}`;
        fs.lstat(path, (err, stat) => {
          if (!stat.isDirectory()) {
            archive.append(templates.fillInTemplateValues(path), {
              name: path
            });
          }
        });
      }
    }).on('end', evt => resolve(true));
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

  fillTemplatesAndAddModulesToArchive(archive).then(r => {
    setTimeout(() => {
      archive.finalize();
    }, 500);
  });
};

program
  .version(version)
  .option('--dir <dir>', 'files to be added to build', 'marketplace_builder')
  .option('--without-assets', 'if present assets directory will be excluded')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

makeArchive(program.target, program.dir, program.withoutAssets);
