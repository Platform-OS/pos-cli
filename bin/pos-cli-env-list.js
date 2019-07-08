#!/usr/bin/env node

const program = require('commander'),
  logger = require('../lib/logger');

program
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .parse(process.argv);

process.env.CONFIG_FILE_PATH = program.configFile;

const list = require('../lib/settings').listEnvironments();

logger.Info('Available environments: ');

for (const id in list) {
  logger.Info(`- ${list[id]}`);
}
