#!/usr/bin/env node

const { program } = require('commander');

program.showHelpAfterError();
program
  .name('pos-cli test')
  .command('run <environment> [name]', 'run tests on instance (all tests if name not provided)')
  .parse(process.argv);
