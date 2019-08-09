const spawn = require('child_process').spawn;
const logger = require('../logger');
const binPath = `${__dirname}/../../bin`;

const createArchive = () => {
  return new Promise((resolve, reject) => {
    spawn(`${binPath}/pos-cli-archive.js`, [], {
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
    spawn(`${binPath}/pos-cli-push.js`, [], {
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
