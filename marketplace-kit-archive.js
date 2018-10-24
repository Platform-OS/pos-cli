#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  shell = require('shelljs'),
  archiver = require('archiver'),
  logger = require('./lib/kit').logger,
  validate = require('./lib/validators'),
  version = require('./package.json').version;

const checkDirectory = directoryPath => {
  validate.directoryExists({ path: directoryPath, message: "marketplace_builder directory doesn't exist - cannot archive it" });
  validate.directoryEmpty({
    path: directoryPath,
    message: 'marketplace_builder is empty. Proceeding would remove everything from your marketplace.'
  });
};

const makeArchive = (path, directory) => {
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

  // - marketplace_builder
  archive.directory(directory, true);
  // - public, public files for the project
  archive.directory('public', true);
  // - private, private files visble only to the creator/owner
  archive.directory('private', true);
  // - modules, installed modules
  archive.directory('modules', true);

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
  archive.finalize();
};

program
  .version(version)
  .option('--dir <dir>', 'files to be added to build', 'marketplace_builder')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

makeArchive(program.target, program.dir);
