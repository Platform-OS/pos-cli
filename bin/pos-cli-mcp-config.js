#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = join(__dirname, '..', 'mcp-min', 'tools.config.json');
const configPath = process.env.MCP_TOOLS_CONFIG || defaultConfigPath;

program
  .name('pos-cli-mcp-config')
  .description('Display MCP server tool configuration')
  .option('--json', 'Output raw JSON')
  .action((opts) => {
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error(`Error reading config: ${configPath}\n${err.message}`);
      process.exit(1);
    }

    const source = process.env.MCP_TOOLS_CONFIG ? 'MCP_TOOLS_CONFIG' : 'default (bundled)';

    if (opts.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    console.log(`Config: ${configPath} (${source})\n`);

    const tools = config.tools || {};
    const enabled = [];
    const disabled = [];

    for (const [name, cfg] of Object.entries(tools)) {
      if (cfg.enabled === false) {
        disabled.push({ name, description: cfg.description || '' });
      } else {
        enabled.push({ name, description: cfg.description || '' });
      }
    }

    console.log(`Enabled (${enabled.length}):`);
    for (const t of enabled) {
      console.log(`  ${t.name.padEnd(26)} ${t.description}`);
    }

    if (disabled.length) {
      console.log(`\nDisabled (${disabled.length}):`);
      for (const t of disabled) {
        console.log(`  ${t.name.padEnd(26)} ${t.description}`);
      }
    }
  });

program.parse();
