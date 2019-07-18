#!/usr/bin/env node

const program = require('commander');

const list = require('../lib/settings').listEnvironments(),
  logger = require('../lib/logger');

program.name('pos-cli env list').parse(process.argv);

logger.Info('Available environments: ');

for (const id in list) {
  logger.Info(`- ${list[id]}`, { hideTimestamp: true });
}
