#!/usr/bin/env node

import { program } from 'commander';

program
  .name('pos-cli generate')
  .command('list', 'list available generators with required params')
  .command('run', 'run specific generator (validates required params)')
  .parse(process.argv);
