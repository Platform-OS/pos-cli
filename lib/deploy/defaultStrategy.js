const spawn = require('child_process').spawn;
const logger = require('../logger');

const createArchive = () => {
  return new Promise((resolve, reject) => {
    spawn('pos-cli-archive', [], {
      stdio: 'inherit'
    }).on('close', exitCode => {
      if (exitCode === 1) {
        reject('Archive creation.');
      }
      resolve();
    });
  });
};

const uploadArchive = () => {
  return new Promise((resolve, reject) => {
    spawn('pos-cli-push', [], {
      stdio: 'inherit'
    }).on('close', exitCode => {
      if (exitCode === 1) {
        reject('Archive upload failed.');
      }
      resolve();
    });
  });
};

const strategy = () => {
  createArchive()
    .then(uploadArchive)
    .catch(reason => {
      logger.Error(`Deploy failed. ${reason}`);
    });
};

module.exports = strategy;
