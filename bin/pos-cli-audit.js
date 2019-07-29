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
    console.log(`\n${chalk.yellow(result.message)} \nAffected files:\n\t${filesFormatted}`);
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
        console.log('\n');
        logger.Warn(`[Audit] ${offences} rule${offences === 1 ? '' : 's'} detected issues. `, { hideTimestamp: true });
        report('Audit', { extras: [{ key: 'auditOffences', value: offences }] });
      } catch (e) {
        logger.Debug(e.message);
      }
    });
  }
};

Audit.run();
