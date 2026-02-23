#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli logsv2')
  .command('search', 'search logs')
  .command('searchAround', 'search stream for records around timestamp')
  .command('alerts', 'manage alerts')
  .command('reports', 'predefined reports based on logs')
  .parse(process.argv);
