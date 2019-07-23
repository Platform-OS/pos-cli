#!/usr/bin/env node

const chalk = require('chalk');

const logger = require('../lib/logger');

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
        logger.Info(`Audit found ${offences} offence${offences > 1 ? 's' : ''}.`, { hideTimestamp: true });
        logger.Info('Our documentation site: https://documentation.platformos.com', { hideTimestamp: true });
      } catch (error) {
        logger.Success('Audit found 0 offences.');
      }

    });
  }
};

Audit.run();
