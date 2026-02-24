#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli clone')
  .command('init [from] [to]', 'start instance clone from to [to]')
  .parse(process.argv);
