#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli modules overwrites')
  .command('diff', 'list all overwrites that have to be updated based on git status')
  .command('list', 'list all overwrites')
  .parse(process.argv);
