const spawn = require('child_process').spawn;
const sep = require('path').sep;
const ora = require('ora');

const logger = require('../logger'),
  Gateway = require('../proxy'),
  assets = require('../assets'),
  files = require('../files');
const binPath = `${__dirname}${sep}..${sep}..${sep}bin`;

const createArchive = () => {
  return new Promise((resolve, reject) => {
    spawn(`${binPath}${sep}pos-cli-archive.js`, ['--without-assets'], {
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
      stdio: 'inherit'
    }).on('close', exitCode => {
      if (exitCode === 1) {
        reject('Server did not accept release file.');
      }
      resolve();
    });
  });
};

const deployAssets = async authData => {
  const assetsToDeploy = await files.getAssets();

  if (assetsToDeploy.length === 0) {
    logger.Warn('There is no assets to deploy, skipping.');
    return;
  }

  ora({ text: 'Uploading assets...', stream: process.stdout, spinner: 'bouncingBar' }).start();
  const gateway = new Gateway(authData);
  assets.deployAssets(gateway);
};

const strategy = ({ authData }) => {
  process.env.FORCE_COLOR = true;

  createArchive()
    .then(uploadArchive)
    .then(() => deployAssets(authData))
    .catch(reason => {
      logger.Error(`Deploy failed. ${reason}`);
    });
};

module.exports = strategy;
