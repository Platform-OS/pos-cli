const chalk = require('chalk');

const logger = require('../lib/logger');

const tags = require('../lib/audit/tags'),
  filters = require('../lib/audit/filters'),
  detailed = require('../lib/audit/detailed'),
  extensions = require('../lib/audit/extensions');

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
  return Promise.all([tags.audit(), filters.audit(), detailed.audit(), extensions.audit()]).then(([tags, filters, detailed, extensions]) => {
    const offences = [...Object.keys(tags), ...Object.keys(filters), ...Object.keys(detailed), extensions].length;

    logger.Warn(`[Audit] ${offences} rule${offences === 1 ? '' : 's'} detected issues.`, { hideTimestamp: true });

    printReport(tags);
    printReport(filters);
    printReport(detailed);
    printReport(extensions);
  });
};

module.exports = {
  run: run
};
