const chalk = require('chalk');

const logger = require('../lib/logger');

const tags = require('../lib/audit/tags'),
  filters = require('../lib/audit/filters'),
  detailed = require('../lib/audit/detailed');

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

const run = async () => {
  return Promise.all([tags.audit(), filters.audit(), detailed.audit()]).then(([tags, filters, detailed]) => {
    const offences = [...Object.keys(tags), ...Object.keys(filters), ...Object.keys(detailed)].length;

    logger.Warn(`[Audit] ${offences} rule${offences === 1 ? '' : 's'} detected issues.`, { hideTimestamp: true });

    printReport(tags);
    printReport(filters);
    printReport(detailed);
  });
};

module.exports = {
  run: run
};
