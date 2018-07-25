#!/usr/bin/env node

const program = require('commander'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

program
  .version(version)
  .command('generate <environment> <name>', 'generate new empty migration')
  .command('run <environment> <name>', 'run migration on environment')
  .parse(process.argv);
