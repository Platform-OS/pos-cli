import { performance } from 'perf_hooks';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { deployAssets } from '../assets.js';
import duration from '../duration.js';
import files from '../files.js';
import { push } from '../push.js';
import logger from '../logger.js';
import report from '../logger/report.js';

let ora;
const initializeEsmModules = async () => {
  if(!ora) {
    await import('ora').then(imported => ora = imported.default);
  }

  return true;
};

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env) => push(env);

const deployAndUploadAssets = async (authData) => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return;
  }
  await deployAssets(new Gateway(authData));
};

const strategy = async ({ env, authData, _params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = (url) => `Deploying to: ${url}`;
    const numberOfFiles = await createArchive(env);

    await initializeEsmModules();
    const spinner = ora({ text: msg(url), stream: process.stdout });
    spinner.start();

    const t0 = performance.now();
    if (numberOfFiles > 0) {
      await uploadArchive(env);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    await deployAndUploadAssets(authData);

    spinner.succeed(`Deploy succeeded after ${duration(t0, performance.now())}`);
  } catch (e) {
    logger.Error(`Deploy failed. ${e}`);
    report('[ERR] Deploy: Direct asset upload');
  }
};

export default strategy;
