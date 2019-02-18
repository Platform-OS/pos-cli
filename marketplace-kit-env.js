#!/usr/bin/env node

const program = require('commander'),
  version = require('./package.json').version;

program
  .version(version)
  .command(
    'add [environment]',
    'Add new environment. Example: marketplace-kit env add staging --email user@example.com --url https://example.com'
  )
  .command('list', 'list all environments')
  .parse(process.argv);

if (!program.args.length) program.help();
