#!/usr/bin/env node

import { program } from 'commander';

program
  .name('pos-cli clone')
  .command('init [from] [to]', 'start instance clone from to [to]')
  .parse(process.argv);
