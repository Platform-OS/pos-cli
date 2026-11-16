#!/usr/bin/env node

import { program } from '../lib/program.js';
import { reportCommandError } from '../lib/reportCommandError.js';
import { addPortal } from '../lib/portals/commands.js';
import { DEFAULT_PORTAL_URL } from '../lib/portals.js';

program.showHelpAfterError();
program
  .name('pos-cli portal add')
  .argument('<name>', 'your name for this Partner Portal. Example: shared')
  .option('--url <url>', 'Partner Portal URL', DEFAULT_PORTAL_URL)
  .option('--force', 'replace the token of a portal that already exists')
  .action(async (name, params) => {
    try {
      await addPortal(name, { url: params.url, force: !!params.force });
    } catch (e) {
      await reportCommandError(e);
    }
  });

program.parse(process.argv);
