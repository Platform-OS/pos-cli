import chalk from 'chalk';

import logger from '../lib/logger.js';

import { audit as tagsAudit } from '../lib/audit/tags.js';
import { audit as filtersAudit } from '../lib/audit/filters.js';
import detailed from '../lib/audit/detailed.js';
import extensions from '../lib/audit/extensions.js';
import duplicateFile from '../lib/audit/duplicateFile.js';
import fileName from './audit/fileName.js';
import orphanedIncludes from '../lib/audit/orphanedIncludes.js';

const auditors = [
  { audit: tagsAudit },
  { audit: filtersAudit },
  detailed,
  extensions,
  duplicateFile,
  fileName,
  orphanedIncludes
];

const printReport = results => {
  if (!results) {
    return;
  }

  for (let ruleName in results) {
    const result = results[ruleName];
    const filesFormatted = result.files.join('\n\t');

    logger.Warn(`${chalk.yellow(result.message)} \nAffected files:\n\t${filesFormatted}`, { hideTimestamp: true });
  }
};

const numberOfOffences = reports => {
  reports = reports.filter(report => Object.keys(report).length > 0);
  if (reports.length == 0) {
    return 0;
  }

  return reports.map(report => Object.keys(report).length).reduce((total, num) => total + num);
};

const run = async () => {
  return Promise.all(auditors.map(auditor => auditor.audit())).then(reports => {
    const offences = numberOfOffences(reports);
    logger.Warn(`[Audit] ${offences} rule${offences === 1 ? '' : 's'} detected issues.`, { hideTimestamp: true });
    reports.forEach(printReport);
  });
};

export { run };
