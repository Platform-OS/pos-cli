#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli logsv2')
  .command('search', 'search logs')
  .command('alerts', 'manage alerts')
  .parse(process.argv);
