#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli uploads')
  .command('upload [environment]', 'export instance data to a json file')
  .command('download [environment]', 'import instance data(from external source) from a json file')
  .parse(process.argv);
