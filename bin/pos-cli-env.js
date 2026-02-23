#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli env')
  .command(
    'add [environment]',
    'Add new environment. Example: pos-cli env add staging --email user@example.com --url https://example.com'
  )
  .command('list', 'list all environments')
  .command('refresh-token', 'Connect to Partner Portal and recreate an authenication token')
  .parse(process.argv);
