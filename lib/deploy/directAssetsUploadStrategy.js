import { performance } from 'perf_hooks';
import ora from 'ora';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { deployAssets } from '../assets.js';
import duration from '../duration.js';
import files from '../files.js';
import { push, printDeployReport } from '../push.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env, { spinner } = {}) => push(env, { spinner });

const deployAndUploadAssets = async (authData, { releaseId } = {}) => {
  const assetsToDeploy = await files.getAssets();
  if (assetsToDeploy.length === 0) {
    logger.Warn('There are no assets to deploy, skipping.');
    return;
  }
  await deployAssets(new Gateway(authData), { releaseId });
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const COMPLETED_STATUSES = new Set(['success', 'done', 'error']);

const waitForAssetReport = async (gateway, releaseId) => {
  if (!gateway || !releaseId) return null;

  const maxAttempts = 600; // up to 10 minutes (600 × 1s)
  try {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await gateway.getStatus(releaseId);
      if (response && response.asset_report) return response.asset_report;
      // Server finished but doesn't support asset_report yet — stop polling
      if (response && COMPLETED_STATUSES.has(response.status)) {
        logger.Debug('Deploy completed without asset_report field, skipping.');
        return null;
      }
      await sleep(1000);
    }
    logger.Debug('Asset report not available after timeout.');
  } catch (e) {
    logger.Debug(`Could not fetch asset report: ${e.message}`);
  }
  return null;
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
    await deployAndUploadAssets(authData, { releaseId });

    spinner.text = 'Waiting for asset processing…';
    const assetReport = await waitForAssetReport(gateway, releaseId);
    const assetDuration = duration(t1, performance.now());

    // Merge asset report into deploy report for unified display
    const mergedReport = Object.assign({}, deployReport || {});
    if (assetReport) mergedReport.Asset = assetReport;

    const verbose = env.VERBOSE === true || env.VERBOSE === 'true';
    const totalDuration = duration(t0, performance.now());

    spinner.stop();
    printDeployReport(mergedReport, { verbose });
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
