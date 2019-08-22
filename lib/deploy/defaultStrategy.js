const spawn = require('child_process').spawn;
const sep = require('path').sep;

const logger = require('../logger');
const binPath = `${__dirname}${sep}..${sep}..${sep}bin`;

const createArchive = () => {
  return new Promise((resolve, reject) => {
    spawn(`${binPath}${sep}pos-cli-archive.js`, [], {
      stdio: 'inherit'
    }).on('close', exitCode => {
      if (exitCode === 1) {
        reject('Archive failed to create.');
      }
      resolve();
    });
  });
};

const uploadArchive = () => {
  return new Promise((resolve, reject) => {
    spawn(`${binPath}${sep}pos-cli-push.js`, [], {
      stdio: 'inherit',
    }).on('close', exitCode => {
      if (exitCode === 1) {
        reject('Server did not accept release file.');
      }
      resolve();
    });
  });
};

const strategy = () => {
  process.env.FORCE_COLOR = true;
  createArchive()
    .then(uploadArchive)
    .catch(reason => {
      logger.Error(`Deploy failed. ${reason}`);
    });
};

module.exports = strategy;
