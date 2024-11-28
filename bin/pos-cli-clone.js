#!/usr/bin/env node

const { program } = require('commander');

program
  .name('pos-cli clone')
  .command('init [from] [to]', 'start instance clone from to [to]')
  .command('list [from] [to]', 'import instance data(from external source) from a json file')
  .command('status [from] [to]', 'update existing instance data from a json file')
  .parse(process.argv);
