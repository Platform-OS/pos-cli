#!/usr/bin/env node

import { program } from '../lib/program.js';
import { buildArchive } from '../lib/modules.js';

program
  .name('pos-cli modules build')
  .option('--path <path>', 'module root directory, default is current directory')
  .action(async (params) => {
    if (params.path) process.chdir(params.path);
    await buildArchive();
  });

program.showHelpAfterError();
program.parse(process.argv);
