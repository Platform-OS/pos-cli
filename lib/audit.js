const chalk = require('chalk');

const logger = require('../lib/logger');

const tags = require('../lib/audit/tags'),
  filters = require('../lib/audit/filters'),
  detailed = require('../lib/audit/detailed'),
  extensions = require('../lib/audit/extensions'),
  duplicateFile = require('../lib/audit/duplicateFile');

const auditors = [tags, filters, detailed, extensions, duplicateFile];

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

const numerofOffences = reports => {
  reports = reports.filter(report => Object.keys(report).length > 0);
  if (reports.length == 0) {
    return 0;
  }

  return reports
    .map(report => Object.keys(report).length)
    .reduce((total, num) => total + num);
};

const run = async () => {
  return Promise.all(auditors.map(auditor => auditor.audit())).then(reports => {
    const offences = numerofOffences(reports);
    logger.Warn(`[Audit] ${offences} rule${offences === 1 ? '' : 's'} detected issues.`, { hideTimestamp: true });
    reports.forEach(printReport);
  });
};

module.exports = {
  run: run
};
