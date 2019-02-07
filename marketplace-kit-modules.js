#!/usr/bin/env node

const program = require('commander'),
  version = require('./package.json').version;

program
  .version(version)
  .command('remove <environment> <name>', 'remove module from instance (removes configuration and data)')
  .command('list <environment>', 'list installed modules')
  .parse(process.argv);
