#!/usr/bin/env node

import { program } from 'commander';

program
  .name('pos-cli logsv2 alerts')
  .command('list [environment]', 'list alerts')
  .command('add [environment]', 'add alert')
  .command('rm [environment]', 'remove alert')
  .command('trigger [environment]', 'trigger alert')
  .parse(process.argv);
