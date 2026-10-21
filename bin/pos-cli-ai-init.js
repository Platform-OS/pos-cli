#!/usr/bin/env node
import { Option } from 'commander';
import { program } from '../lib/program.js';
import { init, DOCS_SCOPES, TOOLS } from '../lib/ai.js';

program
  .name('pos-cli ai init')
  .description(
    'register platformOS MCP servers in your AI tool configuration: the local servers ' +
      '(platformos-cli, platformos-supervisor), and optionally the hosted documentation servers ' +
      '(platformos-liquid, platformos-graphql)'
  )
  .addOption(
    new Option('--tool <tool>', 'skip the interactive prompt and configure the given tool').choices(
      Object.keys(TOOLS)
    )
  )
  .addOption(
    new Option('--docs <scope>', 'where to register the documentation servers; default with --tool is project')
      .choices(DOCS_SCOPES)
  )
  .addOption(new Option('--no-docs', 'do not register the documentation servers'))
  // Declared before --no-agent-playbook so the pair has NO default: unset means "ask when
  // interactive", which is a third state neither flag can express on its own.
  .addOption(
    new Option('--agent-playbook', 'also install the platformOS Agent Playbook in .claude/ (Claude Code only)')
  )
  .addOption(new Option('--no-agent-playbook', 'do not install the Agent Playbook, and do not ask'))
  .action(async (options) => {
    await init({
      tool: options.tool,
      docs: options.docs === false ? 'none' : options.docs,
      agentPlaybook: options.agentPlaybook
    });
  });

program.parse(process.argv);
