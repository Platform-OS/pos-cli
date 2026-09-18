import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import logger from './logger.js';

// The coding-agent profile: about a third of the tool definitions the full set costs every
// request. --no-http because these clients talk stdio, and one listener per session would only
// race the others for the port. Bare `pos-cli-mcp` still serves every tool.
const SERVERS = {
  'platformos-cli': { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] },
  'platformos-supervisor': { command: 'pos-cli-supervisor' }
};

// What earlier releases wrote. An entry still equal to one of these was written by pos-cli rather
// than by a person, so it is upgraded; anything else that differs is a customisation, left alone.
const PREVIOUS_SERVERS = {
  'platformos-cli': [
    { command: 'pos-cli-mcp' },
    { command: 'pos-cli-mcp', args: ['--profile', 'dev'] }
  ]
};

// `platformos` said nothing about which server it was — the supervisor is platformOS too — so it
// is now `platformos-cli`, after the command it runs. Renamed in place, never added beside the old
// entry: two entries start the server twice, and the agent sees every tool twice.
const RENAMED_FROM = { 'platformos-cli': 'platformos' };

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

/** Replaces one key with another, leaving every entry — including this one — where it was. */
const renameKey = (object, from, to, value) => {
  const entries = Object.entries(object).map(([key, current]) => (key === from ? [to, value] : [key, current]));
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, Object.fromEntries(entries));
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
  const renamed = [];
  const customised = [];

  for (const [name, server] of Object.entries(SERVERS)) {
    const desired = tool.entry(server);
    const writtenByUs = entry => isDeepStrictEqual(entry, desired)
      || (PREVIOUS_SERVERS[name] || []).some(previous => isDeepStrictEqual(entry, tool.entry(previous)));

    const oldName = RENAMED_FROM[name];
    const underOldName = oldName === undefined ? undefined : servers[oldName];
    const existing = servers[name];

    // An entry still under the old name: ours to rename, or someone's to leave alone. Either way
    // this iteration is about that entry — adding the new name beside a customised old one is the
    // duplicate the rename exists to avoid.
    if (existing === undefined && underOldName !== undefined) {
      if (!writtenByUs(underOldName)) {
        customised.push({ name: oldName, desired, renamedTo: name });
        continue;
      }
      renameKey(servers, oldName, name, desired);
      renamed.push(`${oldName} → ${name}`);
      continue;
    }

    // Both names present and the old one is ours: the new entry is what runs, so the leftover
    // would only start a second copy.
    if (underOldName !== undefined && writtenByUs(underOldName)) {
      delete servers[oldName];
      renamed.push(`${oldName} (removed; ${name} is the entry now)`);
    }

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

  for (const { name, desired, renamedTo } of customised) {
    await logger.Warn(
      `Kept your customised "${name}" entry in ${tool.file}.` +
        (renamedTo ? ` That server is now registered as "${renamedTo}".` : '') +
        ` pos-cli ai init would write ${JSON.stringify(renamedTo ? { [renamedTo]: desired } : desired)}; ` +
        'merge that in by hand if you want it.'
    );
  }

  if (added.length === 0 && updated.length === 0 && renamed.length === 0) {
    if (customised.length > 0) return;
    return logger.Success(`${tool.label} is already configured in ${tool.file} - nothing to do.`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  if (renamed.length > 0) {
    await logger.Info(`Renamed entries in ${tool.file}: ${renamed.join(', ')}`);
  }
  if (updated.length > 0) {
    await logger.Info(`Updated existing entries in ${tool.file}: ${updated.join(', ')}`);
  }
  const registered = [...added, ...updated];
  await logger.Success(
    registered.length > 0
      ? `Registered MCP servers (${registered.join(', ')}) for ${tool.label} in ${tool.file}`
      : `Updated ${tool.label}'s MCP servers in ${tool.file}`
  );
};

const init = async ({ tool, rootPath = process.cwd() } = {}) => {
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet();
  return configureTool(toolId, rootPath);
};

export { init, SERVERS, PREVIOUS_SERVERS, RENAMED_FROM, TOOLS };
