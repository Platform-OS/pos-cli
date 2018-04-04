#!/usr/bin/env node

const program = require('commander'),
  version = require('./package.json').version;

program
  .version(version)
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .parse(process.argv);

process.env.CONFIG_FILE_PATH = program.configFile;

const list = require('./lib/settings').listEnvironments();

console.log('Available environments:', list.join(', '));
