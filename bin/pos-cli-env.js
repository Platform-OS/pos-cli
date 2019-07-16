#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli env')
  .command(
    'add [environment]',
    'Add new environment. Example: pos-cli env add staging --email user@example.com --url https://example.com'
  )
  .command('list', 'list all environments')
  .parse(process.argv);

if (!program.args.length) {
  program.help();
}
