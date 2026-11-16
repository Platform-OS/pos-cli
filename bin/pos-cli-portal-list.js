#!/usr/bin/env node

import { program } from '../lib/program.js';
import { reportCommandError } from '../lib/reportCommandError.js';
import { listPortals } from '../lib/portals/commands.js';

program
  .name('pos-cli portal list')
  .action(async () => {
    try {
      listPortals();
    } catch (e) {
      await reportCommandError(e);
    }
  });

program.parse(process.argv);
