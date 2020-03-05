#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli app')
  .command('export [environment]', 'export app data to a zip file')
  .parse(process.argv);

