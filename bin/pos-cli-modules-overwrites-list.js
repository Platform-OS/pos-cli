#!/usr/bin/env node

import { program } from 'commander';
import logger from '../lib/logger.js';
import overwrites from '../lib/overwrites.js';

program
  .name('pos-cli modules overwrites list')
  .action(() => {
    logger.Info(overwrites.list());
  });

program.parse(process.argv);
