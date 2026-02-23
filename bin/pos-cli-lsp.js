#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli lsp')
  .description('Start a Language Server Protocol server for platformOS Liquid')
  .action(async () => {
    const { startServer } = await import('@platformos/platformos-language-server-node');
    startServer();
  });

program.parse(process.argv);
