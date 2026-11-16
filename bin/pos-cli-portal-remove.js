#!/usr/bin/env node

import { program } from '../lib/program.js';
import { reportCommandError } from '../lib/reportCommandError.js';
import { removePortalCommand } from '../lib/portals/commands.js';

program.showHelpAfterError();
program
  .name('pos-cli portal remove')
  .argument('<name>', 'name of the portal. Example: shared')
  .option('--keep-token', 'forget the token here without revoking it on the Partner Portal')
  .action(async (name, params) => {
    try {
      await removePortalCommand(name, { keepToken: !!params.keepToken });
    } catch (e) {
      await reportCommandError(e);
    }
  });

program.parse(process.argv);
