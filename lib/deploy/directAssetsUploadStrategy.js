const ora = require('ora'),
      { performance } = require('perf_hooks'),
      Gateway = require('../proxy'),
      archive = require('../archive'),
      assets = require('../assets'),
      duration = require('../duration'),
      files = require('../files'),
      push = require('../push'),
      logger = require('../logger'),
      report = require('../logger/report');

const createArchive = (env) => archive.makeArchive(env, { withoutAssets: true });
const uploadArchive = (env) => push.push(env);

const deployAssets = async (authData) => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return;
  }
  await assets.deployAssets(new Gateway(authData));
};

const strategy = async ({ env, authData, params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = (url) => `Deploying to: ${url}`;
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
  } catch (e) {
    logger.Error(`Deploy failed. ${e}`);
    report('[ERR] Deploy: Direct asset upload');
  }
};

module.exports = strategy;
