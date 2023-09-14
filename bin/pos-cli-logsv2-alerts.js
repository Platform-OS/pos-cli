#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli logsv2 alerts')
  .command('list [environment]', 'list alerts')
  .command('add [environment]', 'add alert')
  .command('rm [environment]', 'remove alert')
  .parse(process.argv);
