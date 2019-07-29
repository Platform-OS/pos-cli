#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

program
  .name('pos-cli init')
  .option('--url <url>', 'theme github repository url')
  .option('--branch <branch>', 'branch where the theme is located')
  .action(async params => {
    const url = params.url || 'mdyd-dev/directory-structure';
    const branch = params.branch ? `#${params.branch}` : '';

    await degit(`${url}${branch}`, { force: false, cache: false, verbose: false })
      .clone('.')
      .then(() => {
        report('Init', { extras: [{ key: 'status', value: 'Success' }] });
        logger.Success('Directory structure sucessfully created.');
      })
      .catch(error => {
        report('Init', { extras: [{ key: 'status', value: 'Error' }, { key: 'trace', value: error }] });
        logger.Error(`Cloning failed. Reason: ${error.message}`);
      });
  });

program.parse(process.argv);
