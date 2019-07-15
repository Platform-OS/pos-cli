const spawn = require('child_process').spawn;
const ora = require('ora');
const logger = require('../logger'),
  Gateway = require('../proxy'),
  assets = require('../assets');

const createArchive = () => {
  return new Promise((resolve, reject) => {
    spawn('pos-cli-archive', ['--without-assets'], {
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
        reject('Archive upload.');
      }
      resolve();
    });
  });
};

const deployAssets = authData => {
  const gateway = new Gateway(authData);
  assets.deployAssets(gateway);
};

const strategy = ({ authData }) => {
  ora({ text: 'Uploading assets...', stream: process.stdout, spinner: 'bouncingBar' }).start();

  createArchive()
    .then(uploadArchive)
    .then(() => deployAssets(authData))
    .catch(reason => {
      logger.Error(`Deploy failed. Reason: ${reason}`);
    });
};

module.exports = strategy;
