#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli migrations')
  .command('generate [environment] <name>', 'generate new empty migration')
  .command('run [environment] <name>', 'run migration on environment')
  .command('list [environment] <name>', 'list migrations and their statuses')
  .parse(process.argv);
