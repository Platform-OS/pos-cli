#!/usr/bin/env node

const chalk = require('chalk');

const logger = require('../lib/logger');

const tags = require('../lib/audit/tags'),
  filters = require('../lib/audit/filters'),
  detailed = require('../lib/audit/detailed');

const printReport = results => {
  for (ruleName in results) {
    const result = results[ruleName];

    const filesFormatted = result.files.join('\n\t');
    const message = `${result.message} \nAffected files:\n\t${filesFormatted}`;

    console.log(`\n${chalk.yellow(message)}\n\n`);
  }
};

const Audit = {
  run: async () => {
    Promise.all([tags.audit(), filters.audit(), detailed.audit()]).then(([tags, filters, detailed]) => {
      if (tags) { printReport(tags); }
      if (filters) { printReport(filters); }
      if (detailed) { printReport(detailed); }

      if (tags || filters || detailed) {
        logger.Success('Visit https://documentation.platformos.com for more information.', { hideTimestamp: true });
      }
    });
  }
};

Audit.run();
