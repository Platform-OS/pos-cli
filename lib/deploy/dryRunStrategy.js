import { performance } from 'perf_hooks';
import ora from 'ora';
import { makeArchive } from '../archive.js';
import { push } from '../push.js';
import duration from '../duration.js';
import logger from '../logger.js';
import report from '../logger/report.js';
import ServerError from '../ServerError.js';

const createArchive = (env) => makeArchive(env, { withoutAssets: true });
const uploadArchive = (env) => push(env);

const strategy = async ({ env, _authData, _params }) => {
  env.DRY_RUN = 'true';

  try {
    process.env.FORCE_COLOR = true;
    const url = env.MARKETPLACE_URL;

    const t0 = performance.now();
    const numberOfFiles = await createArchive(env);

    const spinner = ora({ text: `[DRY RUN] Deploying to: ${url}`, stream: process.stdout });
    spinner.start();

    if (numberOfFiles > 0) {
      await uploadArchive(env);
    } else {
      logger.Warn('There are no files in release file, skipping.');
    }

    spinner.succeed(`Dry run completed after ${duration(t0, performance.now())} - no changes were applied`);
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
