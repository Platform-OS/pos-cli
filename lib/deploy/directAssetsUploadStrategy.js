const ora = require('ora'),
  { performance } = require('perf_hooks');
const Gateway = require('../proxy');
const archive = require('../archive');
const assets = require('../assets');
const duration = require('../duration');
const files = require('../files');
const logger = require('../logger');
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
  await assets.deployAssets(new Gateway(authData));
};

const strategy = async ({env, authData, params}) => {
  try{
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = url => `Deploying to: ${url}`;
    const numberOfFiles = await createArchive(env);
    const spinner = ora({ text: msg(url), stream: process.stdout, spinner: 'bouncingBar' }).start();
    const t0 = performance.now();
    if (numberOfFiles > 0) {
      await uploadArchive(env);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    await deployAssets(authData);

    spinner.succeed(`Deploy succeeded after ${duration(t0, performance.now())}`);
  } catch(e) {
    logger.Error(`Deploy failed. ${e}`);
  };
};

module.exports = strategy;
