#!/usr/bin/env node

const program = require('commander');

program
  .name('pos-cli uploads')
  .command('push [environment]', 'push uploads data into instance')
  // .command('pull [environment]', 'download uploades data from instance into disk')
  .parse(process.argv);
