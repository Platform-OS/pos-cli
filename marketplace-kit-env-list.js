#!/usr/bin/env node

const program = require('commander'),
  logger = require('./lib/kit').logger,
  version = require('./package.json').version;

program
  .version(version)
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .parse(process.argv);

process.env.CONFIG_FILE_PATH = program.configFile;

const list = require('./lib/settings').listEnvironments();

logger.Info('Available environments: ');
for (id in list) {
  logger.Info(`- ${list[id]}`);
}
