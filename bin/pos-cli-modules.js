#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli modules')
  .command('list [environment]', 'list installed modules on the instance')
  .command('pull [environment] <name>', 'pull a module for the instance')
  .command('remove [environment] <name>', 'remove module from the instance (removes configuration and data)')
  .command('setup', 'initialize module lock file for the instance')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('version [version] --package', 'create a new version of the module')
  .command('push', 'publish module version')
  .parse(process.argv);
