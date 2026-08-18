import { performance } from 'perf_hooks';
import ora from '../ora.js';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { deployAssets } from '../assets.js';
import duration from '../duration.js';
import files from '../files.js';
import { push, printDeployReport } from '../push.js';
import waitForAssetReport from './waitForAssetReport.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env, { spinner } = {}) => push(env, { spinner });

const deployAndUploadAssets = async (authData, { releaseId } = {}) => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return false;
  }
  await deployAssets(new Gateway(authData), { releaseId });
  return true;
};

const strategy = async ({ env, authData, _params }) => {
  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;
    const numberOfFiles = await createArchive(env);

    const spinner = ora({ text: `Deploying to: ${url}`, stream: process.stdout });
    spinner.start();

    const t0 = performance.now();
    let releaseId, gateway, deployReport;
    if (numberOfFiles > 0) {
      const result = await uploadArchive(env, { spinner });
      releaseId = result.releaseId;
      gateway = result.gateway;
      deployReport = result.report;
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }
    const archiveDuration = duration(t0, performance.now());

    const t1 = performance.now();
    const assetsDeployed = await deployAndUploadAssets(authData, { releaseId });
    // With no manifest sent there is no asset phase, so skip polling for its report.
    const assetReport = assetsDeployed ? await waitForAssetReport(gateway, releaseId, { spinner }) : null;
    const assetDuration = duration(t1, performance.now());

    const verbose = env.VERBOSE === true || env.VERBOSE === 'true';
    const totalDuration = duration(t0, performance.now());

    spinner.stop();
    printDeployReport(deployReport, { verbose, asset: assetReport });
    logger.Info(`Deploy succeeded after ${totalDuration} (archive: ${archiveDuration}, assets: ${assetDuration})`, { hideTimestamp: true });
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
