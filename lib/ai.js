import fs from 'fs';
import os from 'os';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import ui from './wizardUi.js';
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

// Where to read more once the wizard has finished. The Get Started page is the one that explains
// what was just installed; the reference is for the servers, the tool profiles and the Playbook.
const DOCS_LINKS = [
  ['Get started', 'https://documentation.platformos.com/get-started/ai-assisted-development'],
  ['Reference', 'https://documentation.platformos.com/developer-guide/ai/ai']
];

// opencode 1 keeps each server directly under `mcp`; opencode 2 under `mcp.servers`, and marks
// the older shape deprecated. Its published schema still accepts both, so both are written.
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

// The directory VS Code keeps its user configuration in is per-build, so there is no single path
// to write. These are the documented user-data roots; `vscodeGlobal` appends the build directory
// that actually EXISTS, so pos-cli only ever writes a file the installed build already reads, and
// falls back to printing when it finds none.
const VSCODE_USER_ROOT = {
  win32: (homePath) => process.env.APPDATA || path.join(homePath, 'AppData', 'Roaming'),
  darwin: (homePath) => path.join(homePath, 'Library', 'Application Support')
};

// Preference order, used when more than one build is installed.
const VSCODE_BUILDS = ['Code', 'Code - Insiders', 'VSCodium'];

/**
 * Null when no build directory is there, which `configureTool` reports rather than writing a file
 * nothing would read.
 *
 * `code --add-mcp '<json>'` would avoid the search, and is deliberately not used: measured against
 * VS Code 1.109.5, it replaces an entry of the same name without a word, and leaving an entry the
 * user has edited alone is this command's contract.
 */
const vscodeGlobal = (homePath) => {
  const root = (VSCODE_USER_ROOT[process.platform] ?? configHome)(homePath);
  const dir = VSCODE_BUILDS.map((build) => path.join(root, build, 'User')).find((each) => fs.existsSync(each));
  return dir ? path.join(dir, 'mcp.json') : null;
};

// `global` is the file the tool reads in every project, or null where none could be found.
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
    remote: ({ url }) => ({ url }),
    // Cursor reads `.cursor/rules/*.mdc` with a `globs` field and attaches a matching rule itself,
    // so its archive carries no plugin. Note that this is the same directory `file` is in — see
    // the install order in `init`.
    agentPlaybook: PLAYBOOKS.cursor
  },
  vscode: {
    label: 'VS Code',
    file: '.vscode/mcp.json',
    global: vscodeGlobal,
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
    playbookNote: {
      title: 'Project trust',
      body:
        'pi ignores everything in .pi/ until the project is trusted. Start pi in this project and ' +
        'accept the trust prompt, or set "defaultProjectTrust": "always" in your pi settings.'
    }
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
  other: {
    label: 'Other',
    agentPlaybook: PLAYBOOKS.portable,
    // The portable archive is the one nothing reads on its own: it unpacks to a directory of its
    // own precisely because no tool is known to look there. Said after installing, for the reason
    // pi's note is — the install itself looks like a success either way.
    playbookNote: {
      title: 'One step left',
      body:
        `Nothing reads ${PLAYBOOKS.portable.dir}/ until you point your tool at it. ` +
        `${PLAYBOOKS.portable.dir}/README.md says how, for whichever tool you use.`
    }
  }
};

const ask = (question) => ui.select(question);

const promptForTool = () =>
  ask({
    message: 'Which AI tool do you use?',
    options: Object.entries(TOOLS).map(([value, tool]) => ({ value, label: tool.label }))
  });

const promptForDocsScope = () =>
  ask({
    message: 'Also register the documentation servers?',
    options: [
      { value: 'project', label: 'Yes, for this project', hint: 'the hosted Liquid and GraphQL reference' },
      { value: 'global', label: 'Yes, for all my projects', hint: 'they take no credentials and run no code' },
      { value: 'none', label: 'No', hint: 'only the servers that run on this machine' }
    ]
  });

const promptForOpencodeForm = () =>
  ask({
    message: 'Which opencode configuration format?',
    options: [
      { value: 'v2', label: 'opencode 2', hint: 'servers under mcp.servers (current)' },
      { value: 'v1', label: 'opencode 1', hint: 'servers directly under mcp (legacy)' }
    ]
  });

/**
 * Which form an existing config uses, or `undefined`. Reading the file beats asking: servers
 * belong beside the ones already there. `timeout` is opencode 2's own key and names no server.
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

/** A run that named `--tool` said "do not ask me": it takes the file's form, else the current one. */
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
      `Also install the Agent Playbook in ${tool.agentPlaybook.dir}/?`,
    options: [
      { value: true, label: 'Yes', hint: `platformOS rules and knowledge for ${tool.label}` },
      { value: false, label: 'No' }
    ]
  });

/** "a, b and c". Written out because the list grows with every runner the Playbook supports. */
const sentenceList = (items) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

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
      const supported = Object.entries(TOOLS)
        .filter(([id, each]) => each.agentPlaybook && id !== 'other')
        .map(([, each]) => each.label);
      await ui.warn(
        `The Agent Playbook is available for ${sentenceList(supported)}, each in that tool's own ` +
          `directory, and ${tool.label} reads none of them. Skipped.\n` +
          `The portable archive works anywhere, wired up by hand: ${PLAYBOOKS.portable.url}`
      );
    }
    return { status: 'unsupported' };
  }

  // Checked before prompting rather than after: a question whose answer cannot be honoured is
  // worse than no question. An existing directory holds the user's own rules and settings, and
  // merging a Playbook into it would overwrite them.
  if (fs.existsSync(path.join(rootPath, playbook.dir))) {
    if (agentPlaybook === true || interactive) await ui.info(playbookExistsMessage(playbook));
    return { status: 'exists' };
  }

  // `agentPlaybook` is `undefined` by here, or `true`; `??` reads the three states directly.
  if (!(agentPlaybook ?? (interactive && (await promptForAgentPlaybook(tool))))) return { status: 'declined' };

  try {
    const result = await ui.task(
      {
        start: `Downloading the Agent Playbook for ${tool.label}`,
        done: (r) =>
          r.status === 'installed'
            ? `Installed the platformOS Agent Playbook (${r.files} files) in ${playbook.dir}/`
            : `${playbook.dir}/ already exists — the Playbook was not installed`,
        fail: 'Could not install the platformOS Agent Playbook'
      },
      () => installAgentPlaybook({ rootPath, playbook })
    );
    if (result.status !== 'installed') {
      await ui.info(playbookExistsMessage(playbook));
      return result;
    }
    if (result.manifest?.instructions) await addInstructions(tool, rootPath, result.manifest.instructions);
    if (result.manifest?.agentsFile) await installAgentsFile(tool, rootPath, result.manifest.agentsFile);
    // Said last, so it is the thing left on screen: an untrusted project reads none of this, and
    // nothing about the install itself would have looked wrong.
    if (tool.playbookNote) await ui.note(tool.playbookNote.body, tool.playbookNote.title);
    return result;
  } catch (error) {
    // The servers are registered by now, so this is a warning and not a failure: the user can
    // retry, or unpack the archive themselves.
    await ui.warn(
      `Could not install the platformOS Agent Playbook: ${error.message}\n` +
        `The MCP servers are still registered below. To install the Playbook by hand: ${playbook.url}`
    );
    return { status: 'failed' };
  }
};

/**
 * Codex builds its instruction chain from `AGENTS.md` alone and has no include mechanism, so the
 * Playbook's copy has to BE that file. An existing one is never replaced — it is the user's, and
 * a wizard cannot reconstruct it — so the archive's copy is named instead.
 */
const installAgentsFile = async (tool, rootPath, agentsFile) => {
  const target = path.join(rootPath, 'AGENTS.md');
  if (fs.existsSync(target)) {
    return ui.info(
      `Kept your existing AGENTS.md. ${tool.label} reads only that file, so the Playbook's own ` +
        `instructions are at ${agentsFile} — merge in what you want from them.`
    );
  }

  try {
    fs.copyFileSync(path.join(rootPath, ...agentsFile.split('/')), target);
    await ui.success(`Wrote AGENTS.md in the project root, which is where ${tool.label} reads instructions from`);
  } catch (error) {
    await ui.warn(`Could not write AGENTS.md: ${error.message}\nCopy ${agentsFile} there by hand.`);
  }
};

/**
 * Written to the PROJECT-ROOT config and nowhere else, which is correctness rather than taste:
 * opencode does not document whether a relative `instructions` path resolves against the project
 * root or the file holding it, and a missing instruction file is not reported. The two readings
 * agree only for a config at the root. Paths come from the archive's manifest, so they cannot go
 * stale; entries already present are left alone, so this is safe to run twice.
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
  await ui.success(`Registered the Playbook's instruction files in ${tool.file}`);
};

const remoteEntries = (tool) =>
  Object.fromEntries(Object.entries(DOCS_SERVERS).map(([name, server]) => [name, tool.remote(server)]));

const printManualSnippet = async (withDocs) => {
  const servers = { ...SERVERS, ...(withDocs ? remoteEntries(TOOLS.claude) : {}) };
  await ui.info('Add these MCP servers to your AI tool configuration:', { hideTimestamp: true });
  ui.raw(JSON.stringify({ mcpServers: servers }, null, 2));
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
 * Move servers pos-cli wrote under opencode 1's `mcp.<name>` to opencode 2's `mcp.servers`.
 *
 * Moved, never copied: two entries start the server twice and the agent sees every tool twice.
 * An entry that does not match what an earlier pos-cli wrote is a customisation — left alone and
 * reported, as the `platformos` -> `platformos-cli` rename does. Only called for the newer form.
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
 * TOML basic strings accept the same escapes JSON emits, so `JSON.stringify` is right for the
 * values written here. NOT a general encoder: never pass it a value this file did not build.
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
 * Exact header match: `[mcp_servers.x]` and `[mcp_servers.x.env]` are different tables, and a
 * prefix test would read the second as the first.
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
 * Codex's format, the only one here that is not JSON.
 *
 * APPEND-ONLY by design: merging TOML properly means re-emitting the user's file, which reformats
 * it and drops its comments. Tables are order-independent, so an appended `[mcp_servers.<name>]`
 * means what it would anywhere. The cost is that an entry already present is left alone WITHOUT
 * comparing it — telling ours from theirs needs the parser this avoids — so it is reported.
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
    await ui.info(
      `Left your existing ${present.join(', ')} ${present.length === 1 ? 'entry' : 'entries'} in ${shown} alone.`
    );
  }
  if (added.length === 0) {
    return ui.success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }

  appendText(filePath, `${blocks.join('\n\n')}\n`);
  await ui.success(`Registered MCP servers (${added.join(', ')}) for ${tool.label} in ${shown}`);
};

/** Reads one configuration file, merges the given groups into it, and writes it back if anything changed. */
const updateConfig = async (tool, filePath, shown, groups) => {
  const existed = fs.existsSync(filePath);

  let config = {};
  if (existed) {
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      return ui.error(
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
    await ui.warn(
      `Kept your customised "${name}" entry in ${shown}.` +
        (renamedTo ? ` That server is now registered as "${renamedTo}".` : '') +
        ` pos-cli ai init would write ${JSON.stringify(renamedTo ? { [renamedTo]: desired } : desired)}; ` +
        'merge that in by hand if you want it.'
    );
  }

  for (const name of relocated.customised) {
    await ui.warn(
      `Kept your customised "${name}" entry under mcp in ${shown}. pos-cli now writes servers ` +
        'under mcp.servers; remove the old entry by hand, or opencode will start that server twice.'
    );
  }

  if (added.length === 0 && updated.length === 0 && renamed.length === 0 && relocated.moved.length === 0) {
    if (customised.length > 0 || relocated.customised.length > 0) return;
    return ui.success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }

  writeJson(filePath, config);

  if (relocated.moved.length > 0) {
    await ui.info(`Moved to mcp.servers in ${shown}: ${relocated.moved.join(', ')}`);
  }
  if (renamed.length > 0) {
    await ui.info(`Renamed entries in ${shown}: ${renamed.join(', ')}`);
  }
  if (updated.length > 0) {
    await ui.info(`Updated existing entries in ${shown}: ${updated.join(', ')}`);
  }
  const registered = [...added, ...updated];
  await ui.success(
    registered.length > 0
      ? `Registered MCP servers (${registered.join(', ')}) for ${tool.label} in ${shown}`
      : `Updated ${tool.label}'s MCP servers in ${shown}`
  );
};

const announceManualGlobal = async (tool) => {
  await ui.warn(
    `pos-cli could not find a ${tool.label} user directory to write to. ${tool.globalHint}`
  );
  ui.raw(JSON.stringify(nest(tool.key, remoteEntries(tool)), null, 2));
};

const promptForCodexTrust = () =>
  ask({
    // The consequence is in the question, not only in a hint: trusting a project also lets its
    // hooks run, and that is not something to discover after answering.
    message: 'Mark this project trusted? (also allows its hooks to run)',
    options: [
      { value: true, label: 'Yes', hint: 'pos-cli adds it to your global Codex config' },
      { value: false, label: 'No', hint: 'show me the line to add myself' }
    ]
  });

/** The table that marks one project trusted. The key is the absolute path, as a TOML string. */
const trustTableFor = (rootPath) => `projects.${tomlString(rootPath)}`;

/**
 * Codex ignores a project `.codex/config.toml` until the project is trusted in the user's GLOBAL
 * config — measured on codex-cli 0.166.0, where an untrusted project showed no servers at all.
 *
 * The one place pos-cli would write outside the project, and the flag also lets project hooks
 * run, so it is asked for rather than assumed.
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
    await ui.info(why);
    return ui.note(`${block.trimEnd()}`, `Add this to ${globalPath}`);
  }

  try {
    appendText(globalPath, block);
    await ui.success(`Marked this project trusted in ${globalPath}`);
  } catch (error) {
    await ui.warn(`Could not update ${globalPath}: ${error.message}\n${why}\nAdd this by hand:\n\n${block}`);
  }
};

/** JSON for every tool but Codex, whose configuration is TOML. */
const writeConfig = (tool, ...args) => (tool.format === 'toml' ? updateTomlConfig : updateConfig)(tool, ...args);

const configureTool = async (tool, { rootPath, homePath, scope, codexTrust, interactive }) => {
  const groups = [localGroup(tool)];
  if (scope === 'project') groups.push(docsGroup(tool));

  const written = [tool.file];
  await writeConfig(tool, path.join(rootPath, ...tool.file.split('/')), tool.file, groups);

  // Asked right after the project file is written, because that file is what it makes readable —
  // this is not about the Playbook, which may well be declined.
  if (tool.format === 'toml' && tool.global) {
    await offerCodexTrust(tool, { rootPath, homePath, codexTrust, interactive });
  }

  if (scope !== 'global') return { written };

  // The result, not the property: VS Code's path is searched for and may not be found.
  const globalPath = tool.global?.(homePath);
  if (!globalPath) {
    await announceManualGlobal(tool);
    return { written };
  }

  await writeConfig(tool, globalPath, globalPath, [docsGroup(tool)]);
  written.push(globalPath);
  return { written };
};

/**
 * What the run did. The Playbook row says why nothing was installed when nothing was: "no
 * Playbook" and "one you already had" are different outcomes, and only one needs acting on.
 */
const PLAYBOOK_OUTCOME = {
  installed: (playbook, dir) => `${dir} (${playbook.files} files)`,
  exists: (_playbook, dir) => `${dir} already existed \u2014 left alone`,
  declined: () => 'not installed',
  failed: () => 'download failed \u2014 see the warning above',
  unsupported: () => undefined
};

const summaryRows = (tool, { scope, playbook, config }) => {
  const servers = [
    ...Object.keys(SERVERS),
    ...(scope === 'none' ? [] : Object.keys(DOCS_SERVERS))
  ];
  const outcome = PLAYBOOK_OUTCOME[playbook?.status ?? 'unsupported'];

  return [
    ['Tool', tool.label],
    ['Config', (config?.written ?? []).join(', ')],
    ['Servers', servers.map((name) => name.replace(/^platformos-/, '')).join(', ')],
    ['Documentation servers', scope === 'none' ? 'not registered' : scope === 'global' ? 'all projects' : 'this project'],
    ['Agent Playbook', outcome?.(playbook, tool.agentPlaybook?.dir ? `${tool.agentPlaybook.dir}/` : '')]
  ];
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
  await ui.start('platformOS Agent Kit');

  const toolId = tool || (await promptForTool());
  if (toolId === 'other') {
    // No configuration file to write, so nothing here depends on the order the rest of `init`
    // keeps. The archive unpacks to a directory of its own and is wired up by hand.
    await offerAgentPlaybook(TOOLS.other, { rootPath, agentPlaybook, interactive });
    await printManualSnippet(docs !== 'none');
    await ui.links(DOCS_LINKS);
    return ui.finish('Paste those servers into your tool\u2019s MCP configuration.');
  }

  // Naming a tool means "do not ask me". The documentation servers are on by default there, into
  // the project configuration; --no-docs is how a scripted run opts out.
  const scope = docs || (interactive ? await promptForDocsScope() : 'project');
  const resolved = await resolveTool(toolId, { rootPath, opencodeConfig, interactive });

  // ORDER IS LOAD-BEARING. pi and Codex keep their MCP config INSIDE the Playbook's directory
  // (`.pi/mcp.json`, `.codex/config.toml`), so writing it first creates that directory and the
  // Playbook — which never touches an existing one — declines on every fresh project while
  // reporting success. Nothing in this step can fail the command; it catches its own errors.
  const playbook = await offerAgentPlaybook(resolved, { rootPath, agentPlaybook, interactive });
  const config = await configureTool(resolved, { rootPath, homePath, scope, codexTrust, interactive });

  await ui.summary(summaryRows(resolved, { scope, playbook, config }), 'Setup summary');
  await ui.links(DOCS_LINKS);
  await ui.finish(`Restart ${resolved.label} to pick up the new configuration.`);
};

export { init, SERVERS, DOCS_SERVERS, DOCS_SCOPES, PREVIOUS_SERVERS, RENAMED_FROM, TOOLS, OPENCODE_CONFIG_FORMS };
