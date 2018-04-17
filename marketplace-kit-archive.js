#!/usr/bin/env node

const program = require('commander'),
  fs = require('fs'),
  shell = require('shelljs'),
  archiver = require('archiver'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

const checkDirectory = directory => {
  if (!fs.existsSync(directory)) {
    logger.Error("marketplace_builder directory doesn't exist - cannot archive it");
    process.exit(1);
  }

  if (shell.ls(directory).length == 0) {
    logger.Error('marketplace_builder is empty. Proceeding would remove everything from your marketplace.');
    process.exit(1);
  }
};

const makeArchive = (path, directory) => {
  checkDirectory(directory);

  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);

  const output = fs.createWriteStream(path);
  const archive = archiver('zip', { zlib: { level: 6 } });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function() {
    const sizeInMB = archive.pointer() / 1024 / 1024;
    logger.Info(`Archive size: ${sizeInMB.toFixed(2)} MB`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      logger.Error(err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  archive.directory(directory, false);

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
