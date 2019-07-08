#!/usr/bin/env node

const program = require('commander');

program
  .command('remove [environment] <name>', 'remove module from instance (removes configuration and data)')
  .command('list [environment]', 'list installed modules')
  .parse(process.argv);
