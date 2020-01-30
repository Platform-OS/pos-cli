const ora = require('ora');
const logger = require('../logger');
const Gateway = require('../proxy');
const assets = require('../assets');
const files = require('../files');
const archive = require('../archive');
const push = require('../push');

const createArchive = async(env) => {
  return await archive.makeArchive(env, { withoutAssets: true });
};

const uploadArchive = async(env) => {
  const res = await push.push(env);
  if (!res) throw 'Server did not accept release file.';
};

const deployAssets = async authData => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return;
  }

  ora({ text: 'Uploading assets...', stream: process.stdout, spinner: 'bouncingBar' }).start();
  assets.deployAssets(new Gateway(authData));
};

const strategy = async ({env, authData, params}) => {
  try{
    process.env.FORCE_COLOR = true;
    const numberOfFiles = await createArchive(env);
    if (numberOfFiles > 0) {
      await uploadArchive(env);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }
    await deployAssets(authData);
    logger.Success('Deploy succeeded');
  } catch(e) {
    logger.Error(`Deploy failed. ${e}`);
  };
};

module.exports = strategy;
