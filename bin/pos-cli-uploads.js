#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli uploads')
  .command('push [environment]', 'push uploads files into instance')
  // .command('pull [environment]', 'download uploads files from instance into disk')
  .parse(process.argv);
