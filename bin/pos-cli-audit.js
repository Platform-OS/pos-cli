#!/usr/bin/env node

const chalk = require('chalk');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

const tags = require('../lib/audit/tags'),
  filters = require('../lib/audit/filters'),
  detailed = require('../lib/audit/detailed');

const printReport = results => {
  for (let ruleName in results) {
    const result = results[ruleName];

    const filesFormatted = result.files.join('\n\t');
    const message = `${result.message} \nAffected files:\n\t${filesFormatted}`;

    console.log(`\n${chalk.yellow(message)}\n\n`);
  }
};

const Audit = {
  run: async () => {
    Promise.all([tags.audit(), filters.audit(), detailed.audit()]).then(([tags, filters, detailed]) => {
      printReport(tags);
      printReport(filters);
      printReport(detailed);

      try {
        const offences = [...Object.keys(tags), ...Object.keys(filters), ...Object.keys(detailed)].length;
        logger.Info(`Audit found ${offences} offence${offences === 1 ? '' : 's'}.`, { hideTimestamp: true });
        report.message('Audit', { extras: [{ key: 'auditOffences', value: offences }] });
      } catch (e) {
        logger.Debug(e.message);
      }
    });
  }
};

Audit.run();
