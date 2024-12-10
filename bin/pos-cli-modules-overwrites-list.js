#!/usr/bin/env node

const { program } = require('commander');
const logger = require('../lib/logger');
const overwrites = require('../lib/overwrites');

program
  .name('pos-cli modules overwrites list')
  .action(() => {
    logger.Info(overwrites.list());
  });

program.parse(process.argv);
