#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli gui')
  .command('serve [environment]', 'serve admin editor for files from given environment')
  .parse(process.argv);
