import fs from 'fs';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

import logger from './logger.js';
import report from './logger/report.js';
import Gateway from '../lib/proxy.js';
import duration from '../lib/duration.js';
let gateway;

const toCount = (val) => Array.isArray(val) ? val.length : (typeof val === 'number' ? val : 0);

const printDeployReport = (deployReport) => {
  if (!deployReport) return;

  const lines = [];
  for (const [category, data] of Object.entries(deployReport)) {
    const { upserted = [], deleted = [] } = data || {};
    const upsertedCount = toCount(upserted);
    const deletedCount = toCount(deleted);

    if (upsertedCount === 0 && deletedCount === 0) continue;

    const parts = [];
    if (upsertedCount > 0) parts.push(`${upsertedCount} upserted`);
    if (deletedCount > 0) parts.push(`${deletedCount} deleted`);
    lines.push(`  ${category}: ${parts.join(', ')}`);

    if (Array.isArray(upserted)) {
      upserted.forEach(p => lines.push(`    + ${p}`));
    }
    if (Array.isArray(deleted)) {
      deleted.forEach(p => lines.push(chalk.red(`    - ${p}`)));
    }
  }

  if (lines.length === 0) return;

  logger.Success(['\nDeploy report:', ...lines].join('\n'), { hideTimestamp: true });
};

const getDeploymentStatus = ({ id }) => {
  return new Promise((resolve, reject) => {
    let getStatus = () => {
      gateway
        .getStatus(id)
        .then(response => {
          if (response && response.status === 'ready_for_import') {
            setTimeout(getStatus, 1000);
          } else if (response && response.status === 'error') {
            const body = response.error;
            let message = body.error;
            if (body.details.file_path) {
              message += `\n${body.details.file_path}`;
            }
            return logger.Error(message, { exit: true });
          } else {
            resolve(response);
          }
        })
        .catch(_error => {
          report('getStatus');
          reject(false);
        });
    };
    getStatus();
  });
};

const push = async env => {
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

  gateway = new Gateway(program);
  return gateway
    .push(formData)
    .then(getDeploymentStatus)
    .then((response) => {
      logger.Debug('Release deployed');
      if (response.warning) {
        logger.Warn(response.warning);
      }
      printDeployReport(response.report);
      const t1 = performance.now();
      return duration(t0, t1);
    });
};

export { push };
