#!/usr/bin/env node

const { program } = require('commander');

program
  .name('pos-cli gui')
  .command('serve [environment]', 'serve admin editor for files from given environment')
  .parse(process.argv);