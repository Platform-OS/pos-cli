#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli modules')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('list [environment]', 'list installed modules')
  .command('pull [environment] <name>', 'pull a module for instance')
  .command('push', 'publish module version')
  .command('remove [environment] <name>', 'remove module from instance (removes configuration and data)')
  .command('version <name> [version] --package', 'create a new version of the module')
  .parse(process.argv);
