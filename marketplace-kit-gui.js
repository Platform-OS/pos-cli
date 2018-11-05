#!/usr/bin/env node

const program = require('commander'),
  version = require('./package.json').version;

program
  .version(version)
  .command('serve <environment>', 'serve admin editor for files from <env>')
  .parse(process.argv);

if (!program.args.length) program.help();
