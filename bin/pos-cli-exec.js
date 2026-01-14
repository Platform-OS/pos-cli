#!/usr/bin/env node

const { program } = require('commander');

program
  .name('pos-cli exec')
  .command('liquid <environment> <code>', 'execute liquid code on instance')
  .parse(process.argv);