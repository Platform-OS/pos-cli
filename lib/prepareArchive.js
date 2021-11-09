const fs = require('fs');
const shell = require('shelljs');
const archiver = require('archiver');
const logger = require('./logger');

const prepareDestination = path => {
  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);
};

const prepareArchive = (path, resolve, verbose = false) => {
  let numberOfFiles = 0;
  prepareDestination(path);
  const output = fs.createWriteStream(path);
  const archive = archiver('zip', { zlib: { level: 6 } });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', () => {
    if (verbose) {
      const sizeInMB = archive.pointer() / 1024 / 1024;
      logger.Info(`Archive size: ${sizeInMB.toFixed(2)} MB at ${path}`);
    }
    resolve(numberOfFiles);
  });

  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      logger.Debug(err);
      logger.Error('Archive creation failed.');
    } else {
      throw err;
    }
  });

  archive.on('error', err => {
    logger.Debug(err);
  });

  archive.on('entry', function(entry) {
    if (entry.type == 'file') numberOfFiles++;
  });

  archive.pipe(output);

  return archive;
};

module.exports = prepareArchive;
