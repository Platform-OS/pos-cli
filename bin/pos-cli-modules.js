#!/usr/bin/env node

import { program } from '../lib/program.js';

program.showHelpAfterError();
program
  .name('pos-cli modules')
  .command('list [environment]', 'list installed modules on the instance')
  .command('pull [environment] [name]', 'pull module code from instance to your disk')
  .command('remove [environment] <name>', 'remove module from the instance (removes configuration and data)')
  .command('install [module-name]', 'Add modules, resolve the full dependency tree from pos-module.json, and download all module files. Use --frozen for CI.')
  .command('update [module-name]', 'Update a module (or re-resolve all ranges), write pos-module.lock.json, and download changed modules')
  .command('uninstall <module-name>', 'Remove a module from pos-module.json, delete its files, and update the lock file')
  .command('init <name>', 'initialize a module with the starter structure')
  .command('version [version] --package', 'create a new version of the module')
  .command('build', 'build module release archive without publishing it')
  .command('push', 'publish module version')
  .command('overwrites [command]', 'helps with managing module overwrites')
  .command('migrate', 'migrate app/pos-modules.json to pos-module.json at the project root')
  .command('show <module-name>', 'show available versions of a module from latest to oldest')
  .parse(process.argv);
