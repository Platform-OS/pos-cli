#!/usr/bin/env node

import { program } from '../lib/program.js';
import logger from '../lib/logger.js';
import { addToolSelectionOptions, selectionFrom } from '../mcp-min/cli-args.js';
import { selectTools } from '../mcp-min/tool-selection.js';
import { buildInstructions } from '../mcp-min/instructions.js';

const SOURCE_LABELS = { bundled: 'default (bundled)', MCP_TOOLS_CONFIG: 'MCP_TOOLS_CONFIG' };
const STATE_NOTES = {
  loaded: '',
  missing: ' — not found, so no tool is disabled or redescribed',
  unreadable: ' — could not be read, so no tool is disabled or redescribed',
  unparseable: ' — not valid JSON, so no tool is disabled or redescribed'
};

const reasonText = (reason, profile) => ({
  profile: `not in profile ${profile}`,
  excluded: 'excluded with --exclude-tools',
  disabled: 'disabled in the tools config'
}[reason]);

const listOrNone = names => (names.length ? names.join(', ') : '(none)');

addToolSelectionOptions(program
  .name('pos-cli-mcp-config')
  .description('Display which tools the MCP server exposes, and why the others are not exposed')
  .option('--json', 'Output raw JSON'))
  .action(async (opts) => {
    // The same resolution the server runs at startup, so this prints — and refuses — exactly what
    // `pos-cli-mcp` with these options would.
    let selection;
    try {
      selection = selectTools(selectionFrom(opts));
    } catch (error) {
      if (error?.name !== 'ToolsConfigError') throw error;
      await logger.Error(error.message, { exit: false, notify: false, hideTimestamp: true });
      process.exit(1);
    }

    const { configFile, profile, include, exclude, tools, hidden } = selection;
    const exposed = [...tools].map(([name, tool]) => ({ name, description: tool.description || '' }));
    // The same string the server would send this selection, so it can be read without starting one.
    const instructions = buildInstructions(tools);

    if (opts.json) {
      console.log(JSON.stringify({ config: configFile, profile, include, exclude, exposed, hidden, instructions }, null, 2));
      return;
    }

    console.log(`Config: ${configFile.path} (${SOURCE_LABELS[configFile.source]})${STATE_NOTES[configFile.state]}`);
    console.log(`Profile: ${profile}   --include-tools: ${listOrNone(include)}   --exclude-tools: ${listOrNone(exclude)}\n`);

    console.log(`Exposed (${exposed.length}):`);
    for (const t of exposed) {
      console.log(`  ${t.name.padEnd(26)} ${t.description}`);
    }

    if (hidden.length) {
      console.log(`\nNot exposed (${hidden.length}):`);
      for (const t of hidden) {
        console.log(`  ${t.name.padEnd(26)} ${reasonText(t.reason, profile)}`);
      }
    }

    console.log(`\nInstructions sent to the client (${Buffer.byteLength(instructions)} bytes):`);
    console.log(instructions ? instructions.split('\n').map(line => (line ? `  ${line}` : '')).join('\n') : '  (none)');
  });

await program.parseAsync();
