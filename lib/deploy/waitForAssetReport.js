import { performance } from 'perf_hooks';
import duration from '../duration.js';
import logger from '../logger.js';
import sleep from '../utils/sleep.js';

const POLL_INTERVAL = 1000;
const TIMEOUT = 10 * 60 * 1000;
const BACKOFF_AFTER = 10; // polls at the base interval before easing off
const BACKOFF_CAP = 5; // never slower than 5x the base interval

// Asset jobs usually settle within the first few polls, so poll fast at first and
// ease off — getStatus returns the whole release record, including the deploy
// report's file-path arrays, so a ten-minute wait at a flat 1s would refetch and
// reparse that payload 600 times.
const intervalFor = (poll, base) => base * Math.min(2 ** Math.max(0, poll - BACKOFF_AFTER + 1), BACKOFF_CAP);

// getStatus reports on the asset phase independently of the release status: by the
// time the manifest is accepted the release itself already reads `success`, so its
// status says nothing about assets. `asset_status: 'in_progress'` means keep
// waiting, and `asset_report`/`asset_error` are terminal. A response carrying no
// `asset_status` at all comes from an API that does not report on assets, so there
// is nothing to wait for.
const waitForAssetReport = async (
  gateway,
  releaseId,
  { spinner, pollInterval = POLL_INTERVAL, timeout = TIMEOUT } = {}
) => {
  if (!gateway || !releaseId) return null;

  const t0 = performance.now();
  const deadline = t0 + timeout;
  try {
    for (let poll = 0; performance.now() < deadline; poll++) {
      const { asset_report, asset_error, asset_status } = (await gateway.getStatus(releaseId)) || {};

      if (asset_report) return asset_report;
      if (asset_error) {
        await logger.Error(`Asset deploy failed: ${asset_error.error}`, { exit: false });
        return null;
      }
      if (asset_status !== 'in_progress') {
        logger.Debug('Release carries no in-progress asset status, skipping asset report.');
        return null;
      }

      if (spinner) spinner.text = `Waiting for asset processing (${duration(t0, performance.now())})…`;
      await sleep(Math.min(intervalFor(poll, pollInterval), deadline - performance.now()));
    }
    logger.Warn('Timed out waiting for the asset report — assets may still be processing.');
  } catch (e) {
    logger.Debug(`Could not fetch asset report: ${e.message}`);
  }
  return null;
};

export default waitForAssetReport;
