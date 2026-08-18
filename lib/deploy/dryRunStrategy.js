import { performance } from 'perf_hooks';
import ora from '../ora.js';
import Gateway from '../proxy.js';
import { makeArchive } from '../archive.js';
import { push, printDeployReport } from '../push.js';
import waitForAssetReport from './waitForAssetReport.js';
import { manifestGenerate } from '../assets/manifest.js';
import duration from '../duration.js';
import files from '../files.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env, { spinner } = {}) => push(env, { spinner });

const strategy = async ({ env, authData, _params }) => {
  env.DRY_RUN = 'true';

  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;

    const t0 = performance.now();
    const numberOfFiles = await createArchive(env);

    const spinner = ora({ text: `Deploying to: ${url}`, prefixText: '[DRY RUN]', stream: process.stdout });
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

    // Send the manifest without uploading anything to S3. The release was created
    // with dry_run, so the API validates the manifest against it instead of applying it.
    let assetReport = null;
    const assetsToDeploy = await files.getAssets();
    if (assetsToDeploy.length > 0) {
      spinner.text = 'Validating assets…';
      const manifestGateway = gateway || new Gateway(authData);
      const manifest = await manifestGenerate();
      await manifestGateway.sendManifest(manifest, releaseId);

      assetReport = await waitForAssetReport(manifestGateway, releaseId, { spinner });
    }

    spinner.stop();
    const verbose = env.VERBOSE === true || env.VERBOSE === 'true';
    printDeployReport(deployReport, { verbose, asset: assetReport });
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
