#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli generate')
  .command('list', 'list available generators')
  .command('run', 'run specific generator')
  .parse(process.argv);
