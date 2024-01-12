#!/usr/bin/env node

const program = require('commander');
const logger = require('../lib/logger');

program.showHelpAfterError();
program
  .name('pos-cli modules')
  .command('list [environment]', 'list installed modules on the instance')
  .command('pull [environment] [name]', 'pull module code from instance to your disk')
  .command('download [name]', 'download public module code to your disk, you can specify module version')
  .command('remove [environment] <name>', 'remove module from the instance (removes configuration and data)')
  .command('install [module-with-version]', 'Add new modules and resolve dependencies from pos-modules.json')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('version [version] --package', 'create a new version of the module')
  .command('push', 'publish module version')
  .parse(process.argv);
