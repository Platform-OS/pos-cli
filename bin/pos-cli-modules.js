#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli modules')
  .command('remove [environment] <name>', 'remove module from instance (removes configuration and data)')
  .command('list [environment]', 'list installed modules')
  .command('pull [environment] <name>', 'pull a module')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('install <name>', 'download a platformOS module from github. Do not use "pos-module-" prefix')
  .parse(process.argv);
