import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
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

/**
 * The Liquid language server. Claude Code takes language-server configuration only from a plugin —
 * there is no settings key and no project file it reads on its own — so this prints the two commands
 * rather than writing them: `claude plugin install` does a real install, which a JSON file cannot
 * stand in for. Printing also keeps `pos-cli ai init` free of any dependency on the `claude` binary.
 */
const PLUGIN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin');
const PLUGIN_ID = 'platformos-lsp@platformos';
const REMINDERS_PLUGIN_ID = 'platformos-lsp-reminders@platformos';

/** Reads `enabledPlugins` from one settings file; a missing or unreadable one is simply not a yes. */
const pluginEnabledIn = (settingsPath) => {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))?.enabledPlugins?.[PLUGIN_ID] === true;
  } catch {
    return false;
  }
};

const suggestLanguageServer = async (rootPath) => {
  const alreadyEnabled = [
    path.join(rootPath, '.claude', 'settings.local.json'),
    path.join(rootPath, '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude', 'settings.json')
  ].some(pluginEnabledIn);

  if (alreadyEnabled) {
    return logger.Success('platformOS language server: already registered with Claude Code.');
  }

  // logger.Log, not Info: Info is chalk.bold, and a paragraph of bold text reads as a warning
  // about something that went wrong. This is an offer. chalk handles NO_COLOR and a non-TTY by
  // emitting no escapes at all, so the same lines stay readable when piped.
  const command = (text) => `    ${chalk.cyan(text)}`;
  // Quoted: an installed path can contain spaces, and this is meant to be pasted.
  const marketplace = `claude plugin marketplace add "${PLUGIN_DIR}" --scope local`;

  await logger.Log([
    '',
    chalk.bold('  Optional: platformOS language server'),
    '',
    `  ${chalk.dim('Hover documentation and go-to-definition for .liquid and .graphql, plus')}`,
    `  ${chalk.dim('platformos-check diagnostics on request. It runs as a separate process, so it')}`,
    `  ${chalk.dim('adds nothing to what the model reads on each request.')}`,
    '',
    command(marketplace),
    command(`claude plugin install ${PLUGIN_ID} --scope local`),
    '',
    `  ${chalk.dim('Then restart Claude Code. Use')} ${chalk.dim.italic('--scope user')} ${chalk.dim('on both to enable it for every')}`,
    `  ${chalk.dim('project on this machine.')}`,
    '',
    `  ${chalk.dim('Diagnostics are reported when something asks the server for them — reading or')}`,
    `  ${chalk.dim('editing a file does not trigger them. To be reminded of that after each Liquid')}`,
    `  ${chalk.dim('or GraphQL edit, also install:')}`,
    '',
    command(`claude plugin install ${REMINDERS_PLUGIN_ID} --scope local`),
    ''
  ].join('\n'));
};

const init = async ({ tool, rootPath = process.cwd() } = {}) => {
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet();
  await configureTool(toolId, rootPath);
  // Claude Code only: the plugin mechanism this needs is its own.
  if (toolId === 'claude') await suggestLanguageServer(rootPath);
};

export { init, SERVERS, PREVIOUS_SERVERS, RENAMED_FROM, TOOLS, PLUGIN_DIR, PLUGIN_ID, REMINDERS_PLUGIN_ID };
