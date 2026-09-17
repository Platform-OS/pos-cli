import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import logger from './logger.js';

// The coding-agent profile: about a third of the tool definitions the full set costs every
// request. `pos-cli-mcp` with no arguments still serves every tool.
const SERVERS = {
  platformos: { command: 'pos-cli-mcp', args: ['--profile', 'dev'] },
  'platformos-supervisor': { command: 'pos-cli-supervisor' }
};

// What earlier releases wrote for each server. An entry still equal to one of these was
// written by pos-cli rather than by a person, so it is upgraded to the current form; any other
// entry that differs from the current form is someone's customisation, and is left alone.
const PREVIOUS_SERVERS = {
  platformos: [{ command: 'pos-cli-mcp' }]
};

const TOOLS = {
  claude: { label: 'Claude Code', file: '.mcp.json', key: 'mcpServers', entry: (server) => ({ ...server }) },
  cursor: { label: 'Cursor', file: '.cursor/mcp.json', key: 'mcpServers', entry: (server) => ({ ...server }) },
  vscode: { label: 'VS Code', file: '.vscode/mcp.json', key: 'servers', entry: (server) => ({ type: 'stdio', ...server }) },
  other: { label: 'Other' }
};

const promptForTool = async () => {
  const { select } = await import('@inquirer/prompts');
  try {
    return await select({
      message: 'Which AI tool do you use?',
      choices: Object.entries(TOOLS).map(([value, tool]) => ({ name: tool.label, value }))
    });
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      process.exit(0);
    }
    throw error;
  }
};

const printManualSnippet = async () => {
  await logger.Info('Add these stdio MCP servers to your AI tool configuration:', { hideTimestamp: true });
  await logger.Log(JSON.stringify({ mcpServers: SERVERS }, null, 2));
};

const configureTool = async (toolId, rootPath) => {
  const tool = TOOLS[toolId];
  const configPath = path.join(rootPath, ...tool.file.split('/'));

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      return logger.Error(
        `${tool.file} exists but is not valid JSON: ${error.message}\n` +
          'Fix or remove the file and run pos-cli ai init again.'
      );
    }
  }

  const servers = (config[tool.key] = config[tool.key] || {});
  const added = [];
  const updated = [];
  const customised = [];

  for (const [name, server] of Object.entries(SERVERS)) {
    const desired = tool.entry(server);
    const existing = servers[name];

    // Compared as values, so a hand-formatted entry with its keys in another order is not
    // mistaken for a customisation.
    if (existing === undefined) {
      added.push(name);
    } else if (isDeepStrictEqual(existing, desired)) {
      continue;
    } else if ((PREVIOUS_SERVERS[name] || []).some(previous => isDeepStrictEqual(existing, tool.entry(previous)))) {
      updated.push(name);
    } else {
      customised.push({ name, desired });
      continue;
    }
    servers[name] = desired;
  }

  for (const { name, desired } of customised) {
    await logger.Warn(
      `Kept your customised "${name}" entry in ${tool.file}. pos-cli ai init would write ${JSON.stringify(desired)}; ` +
        'merge that in by hand if you want it.'
    );
  }

  if (added.length === 0 && updated.length === 0) {
    if (customised.length > 0) return;
    return logger.Success(`${tool.label} is already configured in ${tool.file} - nothing to do.`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  if (updated.length > 0) {
    await logger.Info(`Updated existing entries in ${tool.file}: ${updated.join(', ')}`);
  }
  await logger.Success(`Registered MCP servers (${[...added, ...updated].join(', ')}) for ${tool.label} in ${tool.file}`);
};

const init = async ({ tool, rootPath = process.cwd() } = {}) => {
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet();
  return configureTool(toolId, rootPath);
};

export { init, SERVERS, PREVIOUS_SERVERS, TOOLS };
