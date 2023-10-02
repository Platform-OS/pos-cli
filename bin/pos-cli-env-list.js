#!/usr/bin/env node

const logger = require('../lib/logger'),
  files = require('../lib/files');

const listEnvironments = () => {
  const settings = Object(files.getConfig());
  const list = Object.keys(settings);

  if (list.length) {
    logger.Info('Available environments: ');
    for (const id in list) {
      const env = list[id];
      logger.Info(`- [${env}] ${settings[env].url}`, { hideTimestamp: true });
    }
  } else {
    logger.Info('No environments registered yet, please see pos-cli env add', { exit: false });
  }
};

listEnvironments();

