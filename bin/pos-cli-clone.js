#!/usr/bin/env node

const { program } = require('commander');

program
  .name('pos-cli clone')
  .command('init [from] [to]', 'start instance clone from to [to]')
  .parse(process.argv);
