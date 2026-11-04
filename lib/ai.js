import fs from 'fs';
import os from 'os';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import logger from './logger.js';
import { installAgentPlaybook, PLAYBOOKS } from './agentPlaybook.js';

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

// opencode changed where MCP servers live between its two major versions, and the published
// schema still accepts both: opencode 1 keeps each server directly under `mcp`, opencode 2 keeps
// them under `mcp.servers` and marks the older shape deprecated. Which one to write is the user's
// choice, so both are kept here rather than picking one and breaking the other.
const OPENCODE_FORMS = {
  v2: {
    key: ['mcp', 'servers'],
    entry: ({ command, args = [] }) => ({ type: 'local', command: [command, ...args] }),
    remote: ({ url }) => ({ type: 'remote', url })
  },
  v1: {
    key: ['mcp'],
    entry: ({ command, args = [] }) => ({ type: 'local', command: [command, ...args], enabled: true }),
    remote: ({ url }) => ({ type: 'remote', url, enabled: true })
  }
};

const OPENCODE_CONFIG_FORMS = Object.keys(OPENCODE_FORMS);
const OPENCODE_DEFAULT_FORM = 'v2';

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

// Both of these runners let an environment variable move their home directory, and both are read
// by the tool itself — so a `pos-cli ai init` run inside one of them must land in the same place
// the tool will look, not in the user's plain home.
const codexHome = (homePath) => process.env.CODEX_HOME || path.join(homePath, '.codex');
const piAgentDir = (homePath) => process.env.PI_CODING_AGENT_DIR || path.join(homePath, '.pi', 'agent');

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
    remote: ({ url }) => ({ type: 'http', url }),
    // Each archive IS the tool's own directory, so a Playbook belongs to exactly one tool.
    agentPlaybook: PLAYBOOKS.claude
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
    schema: 'https://opencode.ai/config.json',
    // `key`, `entry` and `remote` come from the resolved config form; see OPENCODE_FORMS.
    forms: OPENCODE_FORMS,
    agentPlaybook: PLAYBOOKS.opencode
  },
  pi: {
    label: 'pi',
    // pi keeps MCP servers in a file of their own, not in settings.json.
    file: '.pi/mcp.json',
    global: (homePath) => path.join(piAgentDir(homePath), 'mcp.json'),
    key: 'mcpServers',
    // Measured against pi 1.5.0 by running `pi mcp add` and reading what it wrote: no `type` key,
    // the presence of `command` or `url` selects the transport.
    entry: ({ command, args = [] }) => ({ command, args }),
    remote: ({ url }) => ({ url }),
    agentPlaybook: PLAYBOOKS.pi,
    // pi ignores every `.pi/` resource until the project is trusted, and says so itself. An
    // install that does not mention it looks like a success and does nothing.
    trustNote:
      'pi ignores everything in .pi/ until the project is trusted. Start pi in this project and ' +
      'accept the trust prompt, or set "defaultProjectTrust": "always" in your pi settings.'
  },
  codex: {
    label: 'Codex',
    file: '.codex/config.toml',
    global: (homePath) => path.join(codexHome(homePath), 'config.toml'),
    format: 'toml',
    key: 'mcp_servers',
    // Measured against codex-cli 0.166.0 by running `codex mcp add` and reading the file it wrote.
    entry: ({ command, args = [] }) => ({ command, args }),
    remote: ({ url }) => ({ url }),
    agentPlaybook: PLAYBOOKS.codex
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

const promptForOpencodeForm = () =>
  ask({
    message: 'Which opencode configuration format should pos-cli write?',
    choices: [
      { name: 'opencode 2 - servers under mcp.servers (current)', value: 'v2' },
      { name: 'opencode 1 - servers directly under mcp (legacy)', value: 'v1' }
    ]
  });

/**
 * Which form an existing opencode config already uses, or `undefined` when it says nothing.
 *
 * Reading the file is better than asking: a project that already has servers in one place wants
 * the next one beside them, and a wizard that asks a question it could have answered is a wizard
 * people stop reading. `timeout` is opencode 2's own key under `mcp` and names no server, so it
 * must not be read as one.
 */
const detectOpencodeForm = (filePath) => {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }

  const mcp = config?.mcp;
  if (!mcp || typeof mcp !== 'object') return undefined;
  if (mcp.servers && typeof mcp.servers === 'object') return 'v2';
  return Object.keys(mcp).some((key) => key !== 'timeout') ? 'v1' : undefined;
};

/**
 * The tool as it will be used for this run: for opencode, with the chosen config form folded in.
 *
 * A run that named `--tool` said "do not ask me", so it takes the file's own form when there is
 * one and the current form otherwise.
 */
const resolveTool = async (toolId, { rootPath, opencodeConfig, interactive }) => {
  const tool = TOOLS[toolId];
  if (!tool.forms) return tool;

  const form =
    opencodeConfig ||
    detectOpencodeForm(path.join(rootPath, tool.file)) ||
    (interactive ? await promptForOpencodeForm() : OPENCODE_DEFAULT_FORM);

  return { ...tool, ...tool.forms[form], form };
};

const promptForAgentPlaybook = (tool) =>
  ask({
    message:
      `Also install the platformOS Agent Playbook (platformOS rules and knowledge for ${tool.label}, ` +
      `in ${tool.agentPlaybook.dir}/)?`,
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false }
    ]
  });

/** One state, one sentence — it is reported from two places. */
const playbookExistsMessage = (playbook) =>
  `This project already has a ${playbook.dir}/ directory, so the Agent Playbook was not installed. ` +
  `To merge it in by hand: ${playbook.url}`;

/**
 * Offers the Agent Playbook. Registering the MCP servers is the command's actual job and happens
 * after this, so nothing here may fail `ai init` — every error below is caught and reported.
 *
 * The decision is three-valued. `--agent-playbook` installs without asking (that is how a scripted
 * run opts in), `--no-agent-playbook` declines without asking, and an unset flag asks only when the
 * run is interactive. A run that named `--tool` said "do not ask me", so it gets the Playbook only if
 * it also asked for it.
 */
const offerAgentPlaybook = async (tool, { rootPath, agentPlaybook, interactive }) => {
  const playbook = tool.agentPlaybook;
  if (!playbook) {
    // Never silently ignore a flag the user typed.
    if (agentPlaybook === true) {
      const supported = Object.values(TOOLS).filter((each) => each.agentPlaybook).map((each) => each.label);
      await logger.Warn(
        `The Agent Playbook is available for ${supported.join(' and ')} — each one installs that tool's own ` +
          `directory, and ${tool.label} reads neither. Skipped.`
      );
    }
    return;
  }

  // Checked before prompting rather than after: a question whose answer cannot be honoured is
  // worse than no question. An existing directory holds the user's own rules and settings, and
  // merging a Playbook into it would overwrite them.
  if (fs.existsSync(path.join(rootPath, playbook.dir))) {
    if (agentPlaybook === true || interactive) await logger.Info(playbookExistsMessage(playbook));
    return;
  }

  // `agentPlaybook` is `undefined` by here, or `true`; `??` reads the three states directly.
  if (!(agentPlaybook ?? (interactive && (await promptForAgentPlaybook(tool))))) return;

  try {
    const result = await installAgentPlaybook({ rootPath, playbook });
    if (result.status !== 'installed') return logger.Info(playbookExistsMessage(playbook));

    await logger.Success(
      `Installed the platformOS Agent Playbook (${result.files} files) in ${playbook.dir}/`
    );
    if (result.manifest?.instructions) await addInstructions(tool, rootPath, result.manifest.instructions);
    if (result.manifest?.agentsFile) await installAgentsFile(tool, rootPath, result.manifest.agentsFile);
    // Said last, so it is the thing left on screen: an untrusted project reads none of this, and
    // nothing about the install itself would have looked wrong.
    if (tool.trustNote) await logger.Info(tool.trustNote);
  } catch (error) {
    // The servers are registered by now, so this is a warning and not a failure: the user can
    // retry, or unpack the archive themselves.
    await logger.Warn(
      `Could not install the platformOS Agent Playbook: ${error.message}\n` +
        `The MCP servers are still registered below. To install the Playbook by hand: ${playbook.url}`
    );
  }
};

/**
 * Put the Playbook's instructions where a runner that reads only `AGENTS.md` will find them.
 *
 * Codex builds its instruction chain from `AGENTS.md` files alone and has no include mechanism, so
 * the Playbook's copy has to BE that file. An existing one is never merged into or replaced: it is
 * the user's own, it is concatenated into the same 32 KiB budget, and a wizard that overwrites it
 * would destroy work it cannot reconstruct. The archive's copy stays where it is and is named, so
 * the user can take what they want from it.
 */
const installAgentsFile = async (tool, rootPath, agentsFile) => {
  const target = path.join(rootPath, 'AGENTS.md');
  if (fs.existsSync(target)) {
    return logger.Info(
      `Kept your existing AGENTS.md. ${tool.label} reads only that file, so the Playbook's own ` +
        `instructions are at ${agentsFile} — merge in what you want from them.`
    );
  }

  try {
    fs.copyFileSync(path.join(rootPath, ...agentsFile.split('/')), target);
    await logger.Success(`Wrote AGENTS.md in the project root, which is where ${tool.label} reads instructions from`);
  } catch (error) {
    await logger.Warn(`Could not write AGENTS.md: ${error.message}\nCopy ${agentsFile} there by hand.`);
  }
};

/**
 * Point the tool at the Playbook's always-on instruction files.
 *
 * Written to the PROJECT-ROOT configuration and nowhere else, which is a correctness requirement
 * rather than a preference: opencode does not document whether a relative `instructions` path
 * resolves against the project root or against the file it is written in, a missing instruction
 * file is not reported, and the two readings only agree for a config that sits at the root. The
 * paths come from the archive's own manifest, so adding a rule to the kit cannot leave this
 * writing a stale list.
 *
 * Entries already present are left alone, so this is safe to run twice and cannot reorder or
 * duplicate a list the user has edited.
 */
const addInstructions = async (tool, rootPath, instructions) => {
  const filePath = path.join(rootPath, ...tool.file.split('/'));

  let config = {};
  if (fs.existsSync(filePath)) {
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      // `updateConfig` has already reported this file as unreadable and written nothing.
      return;
    }
  }

  const current = Array.isArray(config.instructions) ? config.instructions : [];
  const missing = instructions.filter((entry) => !current.includes(entry));
  if (missing.length === 0) return;

  config.instructions = [...current, ...missing];
  writeJson(filePath, config);
  await logger.Success(`Registered the Playbook's instruction files in ${tool.file}`);
};

const remoteEntries = (tool) =>
  Object.fromEntries(Object.entries(DOCS_SERVERS).map(([name, server]) => [name, tool.remote(server)]));

const printManualSnippet = async (withDocs) => {
  const servers = { ...SERVERS, ...(withDocs ? remoteEntries(TOOLS.claude) : {}) };
  await logger.Info('Add these MCP servers to your AI tool configuration:', { hideTimestamp: true });
  await logger.Log(JSON.stringify({ mcpServers: servers }, null, 2));
};

/**
 * The object a tool keeps its servers in, created if it is not there.
 *
 * `key` may name a nested path, because opencode 2 keeps servers at `mcp.servers` while every
 * other tool here uses a single top-level key.
 */
const containerFor = (config, key) => {
  const keys = Array.isArray(key) ? key : [key];
  return keys.reduce((node, name) => (node[name] = node[name] || {}), config);
};

/** `['mcp','servers']` + `{a:1}` -> `{mcp:{servers:{a:1}}}`, for printing a snippet to paste. */
const nest = (key, value) =>
  (Array.isArray(key) ? key : [key]).reduceRight((inner, name) => ({ [name]: inner }), value);

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

/**
 * Move the servers pos-cli wrote under opencode 1's `mcp.<name>` to opencode 2's `mcp.servers`.
 *
 * Moved, never copied: two entries for one server start it twice, and the agent then sees every
 * tool twice. An entry that does not match what an earlier pos-cli would have written is a
 * customisation — it stays where it is and is reported, which is the same rule the
 * `platformos` -> `platformos-cli` rename follows.
 *
 * Only ever called when writing the newer form, so a user who chose opencode 1 keeps their file
 * exactly as it is.
 */
const relocateLegacyOpencodeEntries = (config) => {
  const mcp = config.mcp;
  const moved = [];
  const customised = [];
  if (!mcp || typeof mcp !== 'object') return { moved, customised };

  const legacy = OPENCODE_FORMS.v1;
  const ours = [
    ...Object.entries(SERVERS).map(([name, server]) => [name, legacy.entry(server)]),
    ...Object.entries(DOCS_SERVERS).map(([name, server]) => [name, legacy.remote(server)])
  ];

  for (const [name, written] of ours) {
    if (mcp[name] === undefined) continue;
    if (isDeepStrictEqual(mcp[name], written)) {
      delete mcp[name];
      moved.push(name);
    } else {
      customised.push(name);
    }
  }
  return { moved, customised };
};

OPENCODE_FORMS.v2.relocate = relocateLegacyOpencodeEntries;

/**
 * A TOML basic string. `JSON.stringify` is exactly right for the values written here — commands,
 * arguments, URLs and absolute paths — because TOML basic strings accept the same escapes JSON
 * emits. It is NOT a general TOML encoder, and nothing should pass it a value this file did not
 * build.
 */
const tomlString = (value) => JSON.stringify(String(value));

/** One `[<path>]` table, with only the keys an entry actually carries. */
const tomlTable = (tablePath, entry) => {
  const lines = [`[${tablePath}]`];
  if (entry.command !== undefined) lines.push(`command = ${tomlString(entry.command)}`);
  if (Array.isArray(entry.args) && entry.args.length > 0) {
    lines.push(`args = [${entry.args.map(tomlString).join(', ')}]`);
  }
  if (entry.url !== undefined) lines.push(`url = ${tomlString(entry.url)}`);
  return lines.join('\n');
};

/**
 * Whether a TOML document already declares one table, by exact header.
 *
 * Exact, because `[mcp_servers.x]` and `[mcp_servers.x.env]` are different tables and a prefix
 * test would read the second as the first. Server names are TOML bare keys (letters, digits, `-`,
 * `_`), so nothing here needs to handle a quoted header.
 */
const hasTomlTable = (text, tablePath) =>
  new RegExp(`^[ \\t]*\\[[ \\t]*${tablePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*\\]`, 'm').test(text);

/** Appends text to a file, created if absent, written beside the target and renamed on. */
const appendText = (filePath, addition) => {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const separator = existing === '' || existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  writeText(filePath, `${existing}${separator}${addition}`);
};

/** Written beside the target and renamed on, for the reason `writeJson` is. */
const writeText = (filePath, contents) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.pos-cli-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, contents);
    fs.renameSync(temporary, filePath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
};

/**
 * Merge server entries into a TOML configuration — Codex's format, and the only one here that is
 * not JSON.
 *
 * APPEND-ONLY, and that is the whole design. Merging TOML properly means parsing and re-emitting
 * the user's file, which would reformat it, drop its comments, and put a hand-maintained config at
 * the mercy of an encoder written for four known keys. TOML tables are order-independent, so a new
 * `[mcp_servers.<name>]` appended to the end means exactly what it would mean anywhere else.
 *
 * The cost is that an entry already present is left alone WITHOUT comparing it: nothing here can
 * tell an entry pos-cli wrote from one the user did, because that would need the parser this
 * avoids. Reported rather than silently skipped.
 */
const updateTomlConfig = async (tool, filePath, shown, groups) => {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const added = [];
  const present = [];
  const blocks = [];

  for (const { wanted, entryOf } of groups) {
    for (const [name, server] of Object.entries(wanted)) {
      const tablePath = `${tool.key}.${name}`;
      if (hasTomlTable(existing, tablePath)) {
        present.push(name);
        continue;
      }
      blocks.push(tomlTable(tablePath, entryOf(server)));
      added.push(name);
    }
  }

  if (present.length > 0) {
    await logger.Info(
      `Left your existing ${present.join(', ')} ${present.length === 1 ? 'entry' : 'entries'} in ${shown} alone.`
    );
  }
  if (added.length === 0) {
    return logger.Success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }

  appendText(filePath, `${blocks.join('\n\n')}\n`);
  await logger.Success(`Registered MCP servers (${added.join(', ')}) for ${tool.label} in ${shown}`);
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

  // Before the merge, so a server that moves is written in its new place by the merge itself
  // rather than by a second write.
  const relocated = tool.relocate ? tool.relocate(config) : { moved: [], customised: [] };

  const servers = containerFor(config, tool.key);
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

  for (const name of relocated.customised) {
    await logger.Warn(
      `Kept your customised "${name}" entry under mcp in ${shown}. pos-cli now writes servers ` +
        'under mcp.servers; remove the old entry by hand, or opencode will start that server twice.'
    );
  }

  if (added.length === 0 && updated.length === 0 && renamed.length === 0 && relocated.moved.length === 0) {
    if (customised.length > 0 || relocated.customised.length > 0) return;
    return logger.Success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }

  writeJson(filePath, config);

  if (relocated.moved.length > 0) {
    await logger.Info(`Moved to mcp.servers in ${shown}: ${relocated.moved.join(', ')}`);
  }
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
  await logger.Log(JSON.stringify(nest(tool.key, remoteEntries(tool)), null, 2));
};

const promptForCodexTrust = () =>
  ask({
    message: 'Mark this project trusted in your global Codex configuration? This also allows project hooks to run.',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No, show me the line to add myself', value: false }
    ]
  });

/** The table that marks one project trusted. The key is the absolute path, as a TOML string. */
const trustTableFor = (rootPath) => `projects.${tomlString(rootPath)}`;

/**
 * Codex ignores a project `.codex/config.toml` entirely until the project is listed as trusted in
 * the user's GLOBAL config. Measured on codex-cli 0.166.0: with an empty global config the project
 * servers did not appear at all, and adding the block below made them appear at once.
 *
 * That makes this the one place pos-cli would write outside the project, and the flag it sets is
 * not only about MCP — a trusted project may also run project hooks. So it is asked for, never
 * assumed, and a decline still leaves the user able to do it by hand.
 */
const offerCodexTrust = async (tool, { rootPath, homePath, codexTrust, interactive }) => {
  const globalPath = tool.global(homePath);
  const existing = fs.existsSync(globalPath) ? fs.readFileSync(globalPath, 'utf8') : '';
  const table = trustTableFor(rootPath);
  if (hasTomlTable(existing, table)) return;

  const block = `[${table}]\ntrust_level = "trusted"\n`;
  const why = `${tool.label} ignores ${tool.file} until this project is trusted in ${globalPath}.`;

  // `codexTrust` is `undefined` here, or `true`; `??` reads the three states directly.
  if (!(codexTrust ?? (interactive && (await promptForCodexTrust())))) {
    return logger.Info(`${why}\nTo enable it, add this to ${globalPath}:\n\n${block}`);
  }

  try {
    appendText(globalPath, block);
    await logger.Success(`Marked this project trusted in ${globalPath}`);
  } catch (error) {
    await logger.Warn(`Could not update ${globalPath}: ${error.message}\n${why}\nAdd this by hand:\n\n${block}`);
  }
};

/** JSON for every tool but Codex, whose configuration is TOML. */
const writeConfig = (tool, ...args) => (tool.format === 'toml' ? updateTomlConfig : updateConfig)(tool, ...args);

const configureTool = async (tool, { rootPath, homePath, scope, codexTrust, interactive }) => {
  const groups = [localGroup(tool)];
  if (scope === 'project') groups.push(docsGroup(tool));

  await writeConfig(tool, path.join(rootPath, ...tool.file.split('/')), tool.file, groups);

  // Asked right after the project file is written, because that file is what it makes readable —
  // this is not about the Playbook, which may well be declined.
  if (tool.format === 'toml' && tool.global) {
    await offerCodexTrust(tool, { rootPath, homePath, codexTrust, interactive });
  }

  if (scope !== 'global') return;
  if (!tool.global) return announceManualGlobal(tool);

  const globalPath = tool.global(homePath);
  await writeConfig(tool, globalPath, globalPath, [docsGroup(tool)]);
};

const init = async ({
  tool,
  docs,
  agentPlaybook,
  opencodeConfig,
  codexTrust,
  rootPath = process.cwd(),
  homePath = os.homedir()
} = {}) => {
  const interactive = !tool;
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet(docs !== 'none');

  // Naming a tool means "do not ask me". The documentation servers are on by default there, into
  // the project configuration; --no-docs is how a scripted run opts out.
  const scope = docs || (interactive ? await promptForDocsScope() : 'project');
  const resolved = await resolveTool(toolId, { rootPath, opencodeConfig, interactive });

  // The Playbook is installed BEFORE the servers are registered, and the order is load-bearing:
  // pi and Codex keep their MCP configuration INSIDE the directory the Playbook unpacks to
  // (`.pi/mcp.json`, `.codex/config.toml`). Writing that first creates the directory, and the
  // Playbook — which refuses to touch a directory that already exists — would then decline to
  // install on every fresh project, reporting success. Installing first leaves the config write
  // to merge into a directory that is either the Playbook's or the user's, which is what it is
  // built to do. Nothing in this step can fail the command: it catches its own errors.
  await offerAgentPlaybook(resolved, { rootPath, agentPlaybook, interactive });
  await configureTool(resolved, { rootPath, homePath, scope, codexTrust, interactive });
};

export { init, SERVERS, DOCS_SERVERS, DOCS_SCOPES, PREVIOUS_SERVERS, RENAMED_FROM, TOOLS, OPENCODE_CONFIG_FORMS };
