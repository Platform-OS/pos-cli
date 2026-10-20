import fs from 'fs';
import os from 'os';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import logger from './logger.js';
import { installAgentKit, AGENT_KIT_URL, KIT_DIR } from './agentKit.js';

// The coding-agent profile: about a third of the tool definitions the full set costs every
// request. --no-http because these clients talk stdio, and one listener per session would only
// race the others for the port. Bare `pos-cli-mcp` still serves every tool.
const SERVERS = {
  'platformos-cli': { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] },
  'platformos-supervisor': { command: 'pos-cli-supervisor' }
};

// Hosted reference servers: the published Liquid documentation and GraphQL schema. They take no
// credentials and run no code, so the entry is the same for every project and every machine,
// which is what makes registering them globally a sensible offer. Optional because they are a
// network dependency the local servers do not have.
const DOCS_SERVERS = {
  'platformos-liquid': { url: 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp' },
  'platformos-graphql': { url: 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp' }
};

const DOCS_SCOPES = ['project', 'global', 'none'];

/**
 * The only tool the agent kit is offered for. The archive IS a `.claude/` directory — the
 * layout belongs to Claude Code and nothing else reads it — so offering it elsewhere would
 * write a directory the chosen tool ignores.
 */
const AGENT_KIT_TOOL = 'claude';

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

const configHome = (homePath) => process.env.XDG_CONFIG_HOME || path.join(homePath, '.config');

// `global` is the file the tool reads in every project. VS Code has one too, but its path depends
// on the platform and on which build is installed (Code, Insiders, VSCodium), so it is printed
// for the user to paste rather than guessed at.
const TOOLS = {
  claude: {
    label: 'Claude Code',
    file: '.mcp.json',
    global: (homePath) => path.join(homePath, '.claude.json'),
    key: 'mcpServers',
    entry: (server) => ({ ...server }),
    remote: ({ url }) => ({ type: 'http', url })
  },
  cursor: {
    label: 'Cursor',
    file: '.cursor/mcp.json',
    global: (homePath) => path.join(homePath, '.cursor', 'mcp.json'),
    key: 'mcpServers',
    entry: (server) => ({ ...server }),
    remote: ({ url }) => ({ url })
  },
  vscode: {
    label: 'VS Code',
    file: '.vscode/mcp.json',
    global: null,
    globalHint: 'Run the "MCP: Open User Configuration" command in VS Code and add these servers:',
    key: 'servers',
    entry: (server) => ({ type: 'stdio', ...server }),
    remote: ({ url }) => ({ type: 'http', url })
  },
  opencode: {
    label: 'opencode',
    file: 'opencode.json',
    global: (homePath) => path.join(configHome(homePath), 'opencode', 'opencode.json'),
    key: 'mcp',
    schema: 'https://opencode.ai/config.json',
    entry: ({ command, args = [] }) => ({ type: 'local', command: [command, ...args], enabled: true }),
    remote: ({ url }) => ({ type: 'remote', url, enabled: true })
  },
  other: { label: 'Other' }
};

const ask = async (question) => {
  const { select } = await import('@inquirer/prompts');
  try {
    return await select(question);
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      process.exit(0);
    }
    throw error;
  }
};

const promptForTool = () =>
  ask({
    message: 'Which AI tool do you use?',
    choices: Object.entries(TOOLS).map(([value, tool]) => ({ name: tool.label, value }))
  });

const promptForDocsScope = () =>
  ask({
    message: 'Also register the platformOS documentation servers (Liquid and GraphQL reference)?',
    choices: [
      { name: 'Yes, for this project', value: 'project' },
      { name: 'Yes, for all my projects', value: 'global' },
      { name: 'No', value: 'none' }
    ]
  });

const promptForAgentKit = () =>
  ask({
    message:
      'Also install the platformOS agent kit (platformOS rules and knowledge for Claude Code, in .claude/)?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false }
    ]
  });

/**
 * Offers the agent kit after the MCP servers are registered, which is the command's actual job:
 * nothing below may fail `ai init`.
 *
 * The decision is deliberately three-valued. `--agent-kit` installs without asking (that is how
 * a scripted run opts in), `--no-agent-kit` declines without asking, and an unset flag asks only
 * when the run is interactive. A run that named `--tool` said "do not ask me", so it gets the
 * kit only if it also asked for it.
 */
const offerAgentKit = async (toolId, { rootPath, agentKit, interactive }) => {
  if (toolId !== AGENT_KIT_TOOL) {
    // Never silently ignore a flag the user typed.
    if (agentKit === true) {
      await logger.Warn(
        `The agent kit is ${TOOLS[AGENT_KIT_TOOL].label} only — it installs a ${KIT_DIR}/ directory ` +
          `that ${TOOLS[toolId].label} does not read. Skipped.`
      );
    }
    return;
  }
  if (agentKit === false) return;

  // Checked before prompting rather than after: a question whose answer cannot be honoured is
  // worse than no question. An existing `.claude/` holds the user's own rules and settings, and
  // merging a kit into it would overwrite them.
  if (fs.existsSync(path.join(rootPath, KIT_DIR))) {
    if (agentKit === true || interactive) {
      await logger.Info(
        `This project already has a ${KIT_DIR}/ directory, so the agent kit was not installed. ` +
          `To merge it in by hand: ${AGENT_KIT_URL}`
      );
    }
    return;
  }

  if (agentKit !== true && !(interactive && (await promptForAgentKit()))) return;

  try {
    const result = await installAgentKit({ rootPath });
    if (result.status === 'installed') {
      await logger.Success(`Installed the platformOS agent kit (${result.files} files) in ${KIT_DIR}/`);
    } else {
      await logger.Info(`This project already has a ${KIT_DIR}/ directory, so the agent kit was not installed.`);
    }
  } catch (error) {
    // The servers are registered by now, so this is a warning and not a failure: the user can
    // retry, or unpack the archive themselves.
    await logger.Warn(
      `Could not install the platformOS agent kit: ${error.message}\n` +
        `The MCP servers are registered. To install the kit by hand: ${AGENT_KIT_URL}`
    );
  }
};

const remoteEntries = (tool) =>
  Object.fromEntries(Object.entries(DOCS_SERVERS).map(([name, server]) => [name, tool.remote(server)]));

const printManualSnippet = async (withDocs) => {
  const servers = { ...SERVERS, ...(withDocs ? remoteEntries(TOOLS.claude) : {}) };
  await logger.Info('Add these MCP servers to your AI tool configuration:', { hideTimestamp: true });
  await logger.Log(JSON.stringify({ mcpServers: servers }, null, 2));
};

/** Replaces one key with another, leaving every entry — including this one — where it was. */
const renameKey = (object, from, to, value) => {
  const entries = Object.entries(object).map(([key, current]) => (key === from ? [to, value] : [key, current]));
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, Object.fromEntries(entries));
};

/**
 * The servers pos-cli runs on this machine. These are the only ones with a rename and earlier
 * forms to recognise; the documentation servers have never been written under another name.
 */
const localGroup = (tool) => ({
  wanted: SERVERS,
  entryOf: tool.entry,
  previousFor: (name) => (PREVIOUS_SERVERS[name] || []).map(tool.entry),
  oldNameFor: (name) => RENAMED_FROM[name]
});

const docsGroup = (tool) => ({
  wanted: DOCS_SERVERS,
  entryOf: tool.remote,
  previousFor: () => [],
  oldNameFor: () => undefined
});

/** Merges one group of servers into `servers`, in place, and reports what it did. */
const mergeServers = (servers, { wanted, entryOf, previousFor, oldNameFor }) => {
  const added = [];
  const updated = [];
  const renamed = [];
  const customised = [];

  for (const [name, server] of Object.entries(wanted)) {
    const desired = entryOf(server);
    const previous = previousFor(name);
    const writtenByUs = entry =>
      isDeepStrictEqual(entry, desired) || previous.some(form => isDeepStrictEqual(entry, form));

    const oldName = oldNameFor(name);
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
    } else if (previous.some(form => isDeepStrictEqual(existing, form))) {
      updated.push(name);
    } else {
      customised.push({ name, desired });
      continue;
    }
    servers[name] = desired;
  }

  return { added, updated, renamed, customised };
};

/**
 * Written beside the target and renamed on. `~/.claude.json` also holds Claude Code's own project
 * history and session state, and a write interrupted half way would take that with it.
 */
const writeJson = (filePath, config) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.pos-cli-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n');
    fs.renameSync(temporary, filePath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
};

/** Reads one configuration file, merges the given groups into it, and writes it back if anything changed. */
const updateConfig = async (tool, filePath, shown, groups) => {
  const existed = fs.existsSync(filePath);

  let config = {};
  if (existed) {
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      return logger.Error(
        `${shown} exists but is not valid JSON: ${error.message}\n` +
          'Fix or remove the file and run pos-cli ai init again.'
      );
    }
  } else if (tool.schema) {
    config.$schema = tool.schema;
  }

  const servers = (config[tool.key] = config[tool.key] || {});
  const added = [];
  const updated = [];
  const renamed = [];
  const customised = [];

  for (const group of groups) {
    const result = mergeServers(servers, group);
    added.push(...result.added);
    updated.push(...result.updated);
    renamed.push(...result.renamed);
    customised.push(...result.customised);
  }

  for (const { name, desired, renamedTo } of customised) {
    await logger.Warn(
      `Kept your customised "${name}" entry in ${shown}.` +
        (renamedTo ? ` That server is now registered as "${renamedTo}".` : '') +
        ` pos-cli ai init would write ${JSON.stringify(renamedTo ? { [renamedTo]: desired } : desired)}; ` +
        'merge that in by hand if you want it.'
    );
  }

  if (added.length === 0 && updated.length === 0 && renamed.length === 0) {
    if (customised.length > 0) return;
    return logger.Success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }

  writeJson(filePath, config);

  if (renamed.length > 0) {
    await logger.Info(`Renamed entries in ${shown}: ${renamed.join(', ')}`);
  }
  if (updated.length > 0) {
    await logger.Info(`Updated existing entries in ${shown}: ${updated.join(', ')}`);
  }
  const registered = [...added, ...updated];
  await logger.Success(
    registered.length > 0
      ? `Registered MCP servers (${registered.join(', ')}) for ${tool.label} in ${shown}`
      : `Updated ${tool.label}'s MCP servers in ${shown}`
  );
};

const announceManualGlobal = async (tool) => {
  await logger.Warn(
    `pos-cli cannot write ${tool.label}'s user configuration - its location depends on your ` +
      `platform and on which ${tool.label} build you have. ${tool.globalHint}`
  );
  await logger.Log(JSON.stringify({ [tool.key]: remoteEntries(tool) }, null, 2));
};

const configureTool = async (toolId, { rootPath, homePath, scope }) => {
  const tool = TOOLS[toolId];
  const groups = [localGroup(tool)];
  if (scope === 'project') groups.push(docsGroup(tool));

  await updateConfig(tool, path.join(rootPath, ...tool.file.split('/')), tool.file, groups);

  if (scope !== 'global') return;
  if (!tool.global) return announceManualGlobal(tool);

  const globalPath = tool.global(homePath);
  await updateConfig(tool, globalPath, globalPath, [docsGroup(tool)]);
};

const init = async ({ tool, docs, agentKit, rootPath = process.cwd(), homePath = os.homedir() } = {}) => {
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet(docs !== 'none');

  // Naming a tool means "do not ask me". The documentation servers are on by default there, into
  // the project configuration; --no-docs is how a scripted run opts out.
  const scope = docs || (tool ? 'project' : await promptForDocsScope());
  await configureTool(toolId, { rootPath, homePath, scope });
  await offerAgentKit(toolId, { rootPath, agentKit, interactive: !tool });
};

export {
  init,
  SERVERS,
  DOCS_SERVERS,
  DOCS_SCOPES,
  PREVIOUS_SERVERS,
  RENAMED_FROM,
  TOOLS,
  AGENT_KIT_TOOL
};
