#!/usr/bin/env node

import { program } from '../lib/program.js';

program
  .name('pos-cli lsp')
  .description('Start a Language Server Protocol server for platformOS Liquid')
  // Accepted and ignored. Nearly every LSP client passes `--stdio` — it is what
  // vscode-languageclient sends by default, what editors put in their configuration, and the first
  // thing anyone types when checking a server by hand. This server speaks stdio and nothing else,
  // so the flag asks for what it already does; rejecting it as an unknown option made a correct
  // invocation look like a broken install. The transports we genuinely do not serve
  // (`--node-ipc`, `--socket`) stay rejected, which is the honest answer for those.
  .option('--stdio', 'Communicate over stdin/stdout (the default, and the only transport)')
  .action(async () => {
    const { startServer } = await import('@platformos/platformos-language-server-node');
    startServer();
  });

program.parse(process.argv);
