#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli portal')
  .command(
    'add <name>',
    'Sign in to a Partner Portal and store a global token under <name>. Example: pos-cli portal add shared --url https://partners.platformos.com'
  )
  .command('list', 'list the Partner Portals this machine is signed in to')
  .command('remove <name>', 'revoke a portal\'s token and forget it')
  .parse(process.argv);
