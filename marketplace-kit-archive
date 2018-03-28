#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const archiver = require('archiver');
const version = require('./package.json').version;

const makeArchive = (path, directory) => {
  try {
    fs.mkdirSync('./tmp');
  } catch (error) {}

  // create a file to stream archive data to.
  try {
    fs.unlinkSync(path);
  } catch (error) {}

  const output = fs.createWriteStream(path);
  const archive = archiver('zip', { zlib: { level: 6 } });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function() {
    const sizeInMB = archive.pointer() / 1024 / 1024;
    console.log(`Archive size: ${sizeInMB.toFixed(2)} MB`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.log(err);
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
  .option('--dir <dir>', 'files to be added to build', './marketplace_builder')
  .option('--target <target>', 'path to archive', process.env.TARGET || './tmp/marketplace-release.zip')
  .parse(process.argv);

makeArchive(program.target, program.dir);
