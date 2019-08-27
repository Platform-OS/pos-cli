const ora = require('ora');
const logger = require('../logger');
const Gateway = require('../proxy');
const assets = require('../assets');
const files = require('../files');
const archive = require('../archive');
const push = require('../push');

const createArchive = async(env) => {
  const res = await archive.makeArchive(env, { withoutAssets: true });
  if (!res) throw 'Archive failed to create.';
};

const uploadArchive = async(env) => {
  const res = await push.push(env);
  if (!res) throw 'Server did not accept release file.';
};

const deployAssets = async authData => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There is no assets to deploy, skipping.');
    return;
  }

  ora({ text: 'Uploading assets...', stream: process.stdout, spinner: 'bouncingBar' }).start();
  assets.deployAssets(new Gateway(authData));
};

const strategy = async ({env, authData, params}) => {
  try{
    process.env.FORCE_COLOR = true;
    await createArchive(env);
    await uploadArchive(env);
    await deployAssets(authData);
  } catch(e) {
    logger.Error(`Deploy failed. ${e}`);
  };
};

module.exports = strategy;
