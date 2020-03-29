#!/usr/bin/env node

const program = require('commander'),
  degit = require('degit');

const logger = require('../lib/logger'),
  report = require('../lib/logger/report');

program
  .name('pos-cli init')
  .option(
    '--url <url>',
    'structure source repository url (github, bitbucket, gitlab). \nRead more on accepted formats: https://github.com/Rich-Harris/degit#usage \n'
  )
  .option('--branch <branch>', 'branch where the structure is located')
  .action(async params => {
    const url = params.url || 'mdyd-dev/directory-structure';
    const branch = params.branch ? `#${params.branch}` : '';

    degit(`${url}${branch}`, { force: true, cache: false, verbose: false })
      .clone('.')
      .then(() => {
        report('Init', { extras: [{ key: 'status', value: 'Success' }, { key: 'hasBranch', value: !!params.branch }] });
        logger.Success('Directory structure sucessfully created.');
      })
      .catch(error => {
        report('Init', { extras: [{ key: 'status', value: 'Error' }, { key: 'hasBranch', value: !!params.branch }] });
        logger.Error(`Cloning failed. Reason: ${error.message}`);
      });
  });

program.parse(process.argv);
