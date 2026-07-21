#!/usr/bin/env node
import { Option } from 'commander';
import { program } from '../lib/program.js';
import { init } from '../lib/ai.js';

program
  .name('pos-cli ai init')
  .description('register platformOS MCP servers (platformos, platformos-supervisor) in your AI tool configuration')
  .addOption(
    new Option('--tool <tool>', 'skip the interactive prompt and configure the given tool').choices([
      'claude',
      'cursor',
      'vscode',
      'other'
    ])
  )
  .action(async (options) => {
    await init({ tool: options.tool });
  });

program.parse(process.argv);
