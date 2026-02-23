#!/usr/bin/env node

import { program } from 'commander';

program.showHelpAfterError();
program
  .name('pos-cli modules')
  .command('list [environment]', 'list installed modules on the instance')
  .command('pull [environment] [name]', 'pull module code from instance to your disk')
  .command('remove [environment] <name>', 'remove module from the instance (removes configuration and data)')
  .command('install [module-name]', 'Add new modules, resolve dependencies from pos-modules.json, and download all module files')
  .command('update <module-name>', 'Update module to the newest version, resolve dependencies from pos-modules.json, and download all module files')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('version [version] --package', 'create a new version of the module')
  .command('push', 'publish module version')
  .command('overwrites [command]', 'helps with managing module overwrites')
  .parse(process.argv);
