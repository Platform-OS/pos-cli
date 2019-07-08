#!/usr/bin/env node

const program = require('commander'),
  version = require('../package.json').version;

program
  .version(version)
  .command('export [environment]', 'export instance data to a json file')
  .command('import [environment]', 'import instance data(from external source) from a json file')
  .command('update [environment]', 'update existing instance data from a json file')
  .command(
    'clean [environment]',
    'remove all stored data in users, models, etc. Execute with caution there is not comming back.'
  )
  .parse(process.argv);
