#!/usr/bin/env node

const program = require('commander'),
  version = require('./package.json').version;

program
  .version(version)
  .command('deploy <environment>', 'deploy code to environment')
  .alias('d')
  .command('env', 'manage environments')
  .command('sync <environment>', 'update environment on file change')
  .parse(process.argv);

if (!program.args.length) program.help();
