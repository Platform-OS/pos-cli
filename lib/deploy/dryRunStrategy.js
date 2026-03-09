import { performance } from 'perf_hooks';
import ora from 'ora';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { push, printDeployReport } from '../push.js';
import { manifestGenerate } from '../assets/manifest.js';
import duration from '../duration.js';
import files from '../files.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env, { spinner } = {}) => push(env, { spinner });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForAssetReport = async (gateway, releaseId) => {
  if (!gateway || !releaseId) return null;

  const maxAttempts = 600;
  try {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await gateway.getStatus(releaseId);
      if (response && response.asset_report) return response.asset_report;
      await sleep(1000);
    }
    logger.Debug('Asset report not available after timeout.');
  } catch (e) {
    logger.Debug(`Could not fetch asset report: ${e.message}`);
  }
  return null;
};

const strategy = async ({ env, authData, _params }) => {
  env.DRY_RUN = 'true';

  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;

    const t0 = performance.now();
    const numberOfFiles = await createArchive(env);

    const spinner = ora({ text: `[DRY RUN] Deploying to: ${url}`, stream: process.stdout });
    spinner.start();

    let releaseId, gateway, deployReport;
    if (numberOfFiles > 0) {
      const result = await uploadArchive(env, { spinner });
      releaseId = result.releaseId;
      gateway = result.gateway;
      deployReport = result.report;
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    // Generate and send asset manifest (no S3 upload) — the worker reads
    // dry_run from the MarketplaceRelease record via marketplace_release_id
    const assetsToDeploy = await files.getAssets();
    if (assetsToDeploy.length > 0) {
      spinner.text = '[DRY RUN] Validating assets…';
      const manifestGateway = gateway || new Gateway(authData);
      const manifest = await manifestGenerate();
      await manifestGateway.sendManifest(manifest, releaseId);

      spinner.text = '[DRY RUN] Waiting for asset report…';
      const assetReport = await waitForAssetReport(manifestGateway, releaseId);
      if (assetReport) {
        const mergedReport = Object.assign({}, deployReport || {});
        mergedReport.Asset = assetReport;
        deployReport = mergedReport;
      }
    }

    spinner.stop();
    const verbose = env.VERBOSE === true || env.VERBOSE === 'true';
    printDeployReport(deployReport, { verbose });
    logger.Success(`Dry run completed after ${duration(t0, performance.now())} - no changes were applied`, { hideTimestamp: true });
  } catch (e) {
    if (ServerError.isNetworkError(e)) {
      await logger.Error('Dry run failed.', { exit: false });
      await ServerError.handler(e);
      process.exit(1);
    } else {
      await logger.Error(`Dry run failed. ${e}`);
    }
    report('[ERR] Deploy: Dry Run');
  }
};

export default strategy;
