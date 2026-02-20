import { performance } from 'perf_hooks';
import ora from 'ora';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { deployAssets } from '../assets.js';
import duration from '../duration.js';
import files from '../files.js';
import { push } from '../push.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env) => push(env);

const deployAndUploadAssets = async (authData) => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return;
  }
  return deployAssets(new Gateway(authData));
};

const printAssetsReport = (response) => {
  if (!response || !response.report) return;
  const { upserted = 0, deleted = 0 } = response.report;
  const parts = [];
  if (upserted > 0) parts.push(`${upserted} upserted`);
  if (deleted > 0) parts.push(`${deleted} deleted`);
  if (parts.length > 0) {
    logger.Success(`Assets: ${parts.join(', ')}`, { hideTimestamp: true });
  }
};

const strategy = async ({ env, authData, _params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const msg = (url) => `Deploying to: ${url}`;
    const numberOfFiles = await createArchive(env);

    const spinner = ora({ text: msg(url), stream: process.stdout });
    spinner.start();

    const t0 = performance.now();
    const assetsResult = await deployAndUploadAssets(authData);
    printAssetsReport(assetsResult);

    if (numberOfFiles > 0) {
      await uploadArchive(env);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    spinner.succeed(`Deploy succeeded after ${duration(t0, performance.now())}`);
  } catch (e) {
    if (ServerError.isNetworkError(e)) {
      await logger.Error('Deploy failed.', { exit: false });
      await ServerError.handler(e);
      process.exit(1);
    } else {
      await logger.Error(`Deploy failed. ${e}`);
    }
    report('[ERR] Deploy: Direct asset upload');
  }
};

export default strategy;
