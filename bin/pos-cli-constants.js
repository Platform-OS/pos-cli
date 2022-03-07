#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli constants')
  .command(
    'set [environment]',
    'set new constant. Example: pos-cli constants set stating --name TOKEN --value SECRET_TOKEN'
  )
  .command(
    'unset [environment]',
    'Unset new constant. Example: pos-cli constants unset stating --name TOKEN'
  )
  .command(
    'list [environment]',
    'List all constants'
  )
  // .command('list', 'list all environments')
  .parse(process.argv);
