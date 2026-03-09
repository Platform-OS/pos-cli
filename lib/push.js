import fs from 'fs';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

import logger from './logger.js';
import report from './logger/report.js';
import Gateway from '../lib/proxy.js';
import duration from '../lib/duration.js';
let gateway;

const toCount = (val) => Array.isArray(val) ? val.length : (typeof val === 'number' ? val : 0);

const printDeployReport = (deployReport, { verbose = false } = {}) => {
  if (!deployReport) return;

  // First pass: collect rows and find max widths for alignment
  const rows = [];
  for (const [category, data] of Object.entries(deployReport)) {
    const { upserted = [], deleted = [], skipped = [] } = data || {};
    const upsertedCount = toCount(upserted);
    const deletedCount = toCount(deleted);
    const skippedCount = toCount(skipped);

    if (upsertedCount === 0 && deletedCount === 0 && skippedCount === 0) continue;

    rows.push({ category, upsertedCount, deletedCount, skippedCount, upserted, deleted, skipped });
  }

  if (rows.length === 0) return;

  const maxCat = Math.max(...rows.map(r => r.category.length));
  const maxUps = Math.max(...rows.map(r => String(r.upsertedCount).length));
  const maxDel = Math.max(...rows.map(r => String(r.deletedCount).length));
  const maxSkp = Math.max(...rows.map(r => String(r.skippedCount).length));

  // Second pass: build aligned lines
  const lines = [];
  for (const r of rows) {
    const cat = r.category.padEnd(maxCat);
    const ups = String(r.upsertedCount).padStart(maxUps);
    const del = String(r.deletedCount).padStart(maxDel);
    const skp = String(r.skippedCount).padStart(maxSkp);

    lines.push(`  ${cat}  ${ups} upserted  ${chalk.red(`${del} deleted`)}  ${chalk.yellow(`${skp} skipped`)}`);

    if (verbose) {
      if (Array.isArray(r.upserted)) {
        r.upserted.forEach(p => lines.push(`    + ${p}`));
      }
      if (Array.isArray(r.deleted)) {
        r.deleted.forEach(p => lines.push(chalk.red(`    - ${p}`)));
      }
      if (Array.isArray(r.skipped)) {
        r.skipped.forEach(p => lines.push(chalk.yellow(`    ~ ${p}`)));
      }
    }
  }

  logger.Success(['\nDeploy report:', ...lines].join('\n'), { hideTimestamp: true });
};

const MAX_STATUS_RETRIES = 3;
const isTransientError = (e) => e.name === 'RequestError' || (e.name === 'StatusCodeError' && e.statusCode >= 500);

const getDeploymentStatus = ({ id }, { spinner } = {}) => {
  return new Promise((resolve, reject) => {
    let retries = 0;
    let getStatus = () => {
      gateway
        .getStatus(id)
        .then(response => {
          if (response && response.status === 'ready_for_import') {
            if (spinner) spinner.text = 'Deploy scheduled, waiting…';
            setTimeout(getStatus, 1000);
          } else if (response && response.status === 'in_progress') {
            if (spinner) spinner.text = 'Deploy in progress…';
            setTimeout(getStatus, 1000);
          } else if (response && response.status === 'error') {
            const body = response.error;
            let message = body.error;
            if (body.details.file_path) {
              message += `\n${body.details.file_path}`;
            }
            if (body.warnings && body.warnings.length > 0) {
              logger.Warn(body.warnings.join('\n'));
            }
            return logger.Error(message, { exit: true });
          } else {
            resolve(response);
          }
        })
        .catch(error => {
          if (isTransientError(error) && retries < MAX_STATUS_RETRIES) {
            retries++;
            logger.Debug(`getStatus failed, retrying (${retries}/${MAX_STATUS_RETRIES})...`);
            setTimeout(getStatus, 1000 * retries);
          } else {
            report('getStatus');
            reject(error);
          }
        });
    };
    getStatus();
  });
};

const push = async (env, { spinner } = {}) => {
  const program = {
    email: env.MARKETPLACE_EMAIL,
    token: env.MARKETPLACE_TOKEN,
    url: env.MARKETPLACE_URL
  };
  const t0 = performance.now();
  const formData = {
    'marketplace_builder[partial_deploy]': env.PARTIAL_DEPLOY || 'false',
    'marketplace_builder[zip_file]': fs.createReadStream('./tmp/release.zip')
  };

  if (env.DRY_RUN === 'true') {
    formData['marketplace_builder[dry_run]'] = 'true';
  }

  gateway = new Gateway(program);
  return gateway
    .push(formData)
    .then(res => getDeploymentStatus(res, { spinner }))
    .then((response) => {
      logger.Debug('Release deployed');
      if (response.warning) {
        logger.Warn(response.warning);
      }
      const t1 = performance.now();
      return { duration: duration(t0, t1), releaseId: response.id, gateway, report: response.report };
    });
};

export { push, printDeployReport };
