#!/usr/bin/env node
import { Option } from 'commander';
import { program } from '../lib/program.js';
import { init, DOCS_SCOPES, TOOLS, OPENCODE_CONFIG_FORMS } from '../lib/ai.js';

const PLAYBOOK_TOOLS = Object.values(TOOLS)
  .filter((tool) => tool.agentPlaybook)
  .map((tool) => tool.label)
  .join(', ');

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
    new Option(
      '--agent-playbook',
      // Derived rather than written out: a tool gaining a Playbook should not leave this help
      // text naming the tools that had one before it.
      `also install the platformOS Agent Playbook in the tool's own directory (${PLAYBOOK_TOOLS})`
    )
  )
  .addOption(new Option('--no-agent-playbook', 'do not install the Agent Playbook, and do not ask'))
  // opencode's two major versions keep MCP servers in different places and its published schema
  // still accepts both, so which to write is the user's call. Unset, pos-cli follows the form the
  // file already uses, and asks only when the file says nothing and the run is interactive.
  .addOption(
    new Option('--opencode-config <form>', 'which opencode configuration format to write')
      .choices(OPENCODE_CONFIG_FORMS)
  )
  // Codex ignores a project `.codex/config.toml` until the project is listed as trusted in the
  // user's GLOBAL config, and that same flag also lets project hooks run. It is the one thing
  // `ai init` would write outside the project, so it is never assumed: declared before
  // --no-codex-trust so the pair has NO default, and an unset flag asks only when interactive.
  .addOption(
    new Option('--codex-trust', "mark this project trusted in your global Codex configuration (Codex only)")
  )
  .addOption(new Option('--no-codex-trust', 'do not mark the project trusted, and do not ask'))
  .action(async (options) => {
    await init({
      tool: options.tool,
      docs: options.docs === false ? 'none' : options.docs,
      agentPlaybook: options.agentPlaybook,
      opencodeConfig: options.opencodeConfig,
      codexTrust: options.codexTrust
    });
  });

program.parse(process.argv);
