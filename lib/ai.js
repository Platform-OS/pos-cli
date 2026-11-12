import fs from 'fs';
import os from 'os';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import ui from './wizardUi.js';
import { installAgentPlaybook, playbookDirState, readManifest, PLAYBOOKS } from './agentPlaybook.js';
import { appendBlock, checked, isTable, parseToml, setInTable, tomlKey, tomlString } from './tomlEdit.js';
import { applyPermissions, permissionsOf, supportsPosixPermissions } from './filePermissions.js';

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
    agentPlaybook: PLAYBOOKS.opencode,
    // The only tool whose config has an `instructions` list. A manifest arrives over the network,
    // so its `instructions` are honoured only for a tool that reads them.
    acceptsInstructions: true
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
    // pi ignores every `.pi/` resource until the project is trusted — `.pi/mcp.json` included, so
    // this is said whether or not the Playbook was installed. A run that does not mention it looks
    // like a success and does nothing.
    trustNote: {
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
    agentPlaybook: PLAYBOOKS.codex,
    // The only tool whose instructions come from the project-root AGENTS.md alone; see
    // `installAgentsFile`.
    acceptsAgentsFile: true
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

  return withForm(tool, form);
};

/** Each form carries its own `relocate`, so the spread replaces whichever the tool had. */
const withForm = (tool, form) => ({ ...tool, ...tool.forms[form], form });

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
 * Files of the tool's own configuration that live INSIDE its Playbook directory — `.pi/mcp.json`,
 * `.codex/config.toml`, `.cursor/mcp.json` — relative to that directory. A directory holding only
 * these was made by pos-cli, not by the user, so it does not stop the Playbook installing.
 */
const keptInside = (tool) => {
  if (!tool.file || !tool.agentPlaybook) return [];
  const relative = path.posix.relative(tool.agentPlaybook.dir, tool.file);
  return relative.startsWith('..') ? [] : [relative];
};

/**
 * Offers the Agent Playbook, and installs it. Wiring it into the tool's configuration happens
 * later, in `wirePlaybook`, once that configuration has been written. Registering the MCP servers
 * is the command's actual job, so nothing here may fail `ai init`: an install error is reported.
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
  if (agentPlaybook === false) return { status: 'declined' };

  // Checked before prompting rather than after: a question whose answer cannot be honoured is
  // worse than no question. An existing directory holds the user's own rules and settings, and
  // merging a Playbook into it would overwrite them.
  const keep = keptInside(tool);
  const target = path.join(rootPath, playbook.dir);
  if (playbookDirState(target, keep) === 'occupied') {
    // A Playbook a previous run installed is wired again — it may have stopped at a config that
    // would not parse, or at a Ctrl-C. Without this a rerun could never finish the job, since the
    // directory it would install into is already there. Its manifest is how it is recognised.
    const manifest = readManifest(target, playbook.dir);
    if (manifest) {
      await ui.info(`The Agent Playbook is already in ${playbook.dir}/.`);
      return { status: 'present', manifest };
    }
    if (agentPlaybook === true || interactive) await ui.info(playbookExistsMessage(playbook));
    return { status: 'exists' };
  }

  // `agentPlaybook` is `undefined` by here, or `true`; `??` reads the three states directly.
  if (!(agentPlaybook ?? (interactive && (await promptForAgentPlaybook(tool))))) return { status: 'declined' };

  let result;
  try {
    // No `fail` text: the warning below is the one report of a failure, in either mode.
    result = await ui.task(
      {
        start: `Downloading the Agent Playbook for ${tool.label}`,
        // Nothing for `exists`: that is reported below, once, and not as a success.
        done: (r) =>
          r.status === 'installed' ? `Installed the platformOS Agent Playbook (${r.files} files) in ${playbook.dir}/` : undefined
      },
      () => installAgentPlaybook({ rootPath, playbook, ...(keep.length > 0 ? { keep } : {}) })
    );
  } catch (error) {
    await ui.warn(
      `Could not install the platformOS Agent Playbook: ${error.message}\n` +
        `The MCP servers are registered regardless. To install the Playbook by hand: ${playbook.url}`
    );
    return { status: 'failed' };
  }

  if (result.status !== 'installed') {
    await ui.info(playbookExistsMessage(playbook));
    return result;
  }
  ui.recordChange();
  // The archive carried its own copy of a file the tool's configuration already had; the existing
  // one was kept, so whatever the Playbook sets in it is not in effect.
  for (const file of result.overridden ?? []) {
    await ui.warn(
      `The Playbook ships its own ${playbook.dir}/${file}; your existing one was kept. ` +
        `Compare it with the archive's copy and merge what you need: ${playbook.url}`
    );
  }
  return result;
};

/**
 * What an installed Playbook asks of the tool's configuration, applied once that configuration
 * exists. Each step reports its own failure: the Playbook itself is installed by now, so a file
 * that could not be updated is not an install failure.
 *
 * Also run for a Playbook that was already there, and so idempotent: an instruction already
 * listed is not added again, and an AGENTS.md already equal to the Playbook's is left in silence.
 */
const wirePlaybook = async (tool, rootPath, result) => {
  if (!['installed', 'present'].includes(result?.status)) return;
  const { instructions, agentsFile } = result.manifest ?? {};

  if (instructions && tool.acceptsInstructions) {
    try {
      await addInstructions(tool, rootPath, instructions);
    } catch (error) {
      await ui.warn(
        `Could not register the Playbook's instruction files in ${tool.file}: ${error.message}\n` +
          `Add them to its "instructions" list by hand: ${instructions.join(', ')}`
      );
    }
  }
  // Gated like `instructions`, for the same reason: the manifest arrives over the network, and a
  // file in the project root that the tool does not read is clutter the user then has to own.
  if (agentsFile && tool.acceptsAgentsFile) await installAgentsFile(tool, rootPath, agentsFile);
  // Said last, so it is the thing left on screen: nothing about the install would look wrong.
  if (tool.playbookNote && result.status === 'installed') await ui.note(tool.playbookNote.body, tool.playbookNote.title);
};

const sameContents = (a, b) => {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
};

/**
 * Codex builds its instruction chain from `AGENTS.md` alone and has no include mechanism, so the
 * Playbook's copy has to BE that file. An existing one is never replaced — it is the user's, and
 * a wizard cannot reconstruct it — so the archive's copy is named instead.
 */
const installAgentsFile = async (tool, rootPath, agentsFile) => {
  const target = path.join(rootPath, 'AGENTS.md');
  const source = path.join(rootPath, ...agentsFile.split('/'));
  if (fs.existsSync(target)) {
    if (sameContents(target, source)) return;
    return ui.info(
      `Kept your existing AGENTS.md. ${tool.label} reads only that file, so the Playbook's own ` +
        `instructions are at ${agentsFile} — merge in what you want from them.`
    );
  }

  try {
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    ui.recordChange();
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

  // Errors are left to the caller to report: the Playbook is installed either way.
  const { contents } = editFile(filePath, (text) => {
    const config = text === null ? (tool.schema ? { $schema: tool.schema } : {}) : parseJsonObject(text);
    const current = config.instructions ?? [];
    // Replacing a value the user wrote is not ours to do, whatever shape it has.
    if (!Array.isArray(current)) throw new Error('its "instructions" is not a list');
    const missing = instructions.filter((entry) => !current.includes(entry));
    if (missing.length === 0) return {};
    config.instructions = [...current, ...missing];
    return { contents: jsonText(config, text) };
  });
  if (contents !== undefined) await ui.success(`Registered the Playbook's instruction files in ${tool.file}`);
};

const remoteEntries = (tool) =>
  Object.fromEntries(Object.entries(DOCS_SERVERS).map(([name, server]) => [name, tool.remote(server)]));

const printManualSnippet = async (withDocs) => {
  const servers = { ...SERVERS, ...(withDocs ? remoteEntries(TOOLS.claude) : {}) };
  await ui.info('Add these MCP servers to your AI tool configuration:', { hideTimestamp: true });
  await ui.raw(JSON.stringify({ mcpServers: servers }, null, 2));
};

/**
 * The object a tool keeps its servers in, created if it is not there.
 *
 * `key` may name a nested path, because opencode 2 keeps servers at `mcp.servers` while every
 * other tool here uses a single top-level key.
 */
const containerFor = (config, key) => {
  const keys = Array.isArray(key) ? key : [key];
  return keys.reduce((node, name) => {
    if (node[name] === undefined || node[name] === null) node[name] = {};
    // A string or a list here cannot hold servers: writing into it would throw, or be dropped.
    if (!isPlainObject(node[name])) throw new Error(`"${keys.join('.')}" is not an object`);
    return node[name];
  }, config);
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
  build: localGroup,
  wanted: SERVERS,
  entryOf: tool.entry,
  previousFor: (name) => (PREVIOUS_SERVERS[name] || []).map(tool.entry),
  oldNameFor: (name) => RENAMED_FROM[name]
});

const docsGroup = (tool) => ({
  build: docsGroup,
  wanted: DOCS_SERVERS,
  entryOf: tool.remote,
  previousFor: () => [],
  oldNameFor: () => undefined
});

/** Merges one group of servers into `servers`, in place, and reports what it did. */
const mergeServers = (servers, { wanted, entryOf, previousFor, oldNameFor }, skip = new Set()) => {
  const added = [];
  const updated = [];
  const renamed = [];
  const customised = [];

  for (const [name, server] of Object.entries(wanted)) {
    // Still registered in the other opencode layout, as the user left it: a second entry here
    // would start the server twice.
    if (skip.has(name)) continue;
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
 *
 * The rename replaces whatever was at the path, so two things are carried over by hand. A symlink
 * is followed and its target written — a config linked from a dotfiles repository stays linked.
 * And the existing file's mode is kept: these are global files that can hold API keys in an
 * `env` block, and one kept at 0600 must not come back as a fresh, umask-default 0644.
 */
const replaceFile = (filePath, contents, { expected } = {}) => {
  let target = filePath;
  let mode;
  try {
    target = fs.realpathSync(filePath);
    if (supportsPosixPermissions) mode = permissionsOf(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.pos-cli-${process.pid}.tmp`;
  try {
    // The mode given on creation is narrowed by the umask, so it can only be tighter than asked;
    // `applyPermissions` is what makes it exact. Given on creation so the copy of a 0600 file is
    // never readable by others, even before the chmod.
    fs.writeFileSync(temporary, contents, mode === undefined ? undefined : { mode });
    applyPermissions(temporary, mode);
    // Checked as late as possible: Claude Code rewrites ~/.claude.json while it runs, and
    // `ai init` is often run from inside it. Renaming over a newer file would drop that write.
    if (expected !== undefined && readText(target) !== expected) {
      throw Object.assign(new Error(`${filePath} changed while pos-cli was updating it`), { code: 'ECHANGED' });
    }
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  ui.recordChange();
};

/** The file's text, or null when there is none. Any other read error is the caller's to report. */
const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

/**
 * Read, plan, write — and plan again if the file changed in between. `plan(text)` is pure and
 * returns `{ contents }` to write, or no `contents` when there is nothing to write.
 */
const editFile = (filePath, plan) => {
  for (let attempt = 1; ; attempt += 1) {
    const text = readText(filePath);
    const result = plan(text);
    if (result.contents === undefined) return result;
    try {
      replaceFile(filePath, result.contents, { expected: text });
      return result;
    } catch (error) {
      if (error.code !== 'ECHANGED' || attempt === 3) throw error;
    }
  }
};

const BOM = '﻿';

/**
 * A JSON config file's contents, which must be an object: a file holding `[]` or `null` would
 * otherwise take the servers as properties JSON.stringify drops, and be reported as configured.
 */
const parseJsonObject = (text) => {
  let value;
  try {
    value = JSON.parse(text.startsWith(BOM) ? text.slice(1) : text);
  } catch (error) {
    throw new Error(`it is not valid JSON: ${error.message}`);
  }
  if (!isPlainObject(value)) throw new Error('its top level is not an object');
  return value;
};

const jsonText = (config, original) => (original?.startsWith(BOM) ? BOM : '') + JSON.stringify(config, null, 2) + '\n';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Move servers pos-cli wrote in the other opencode form into the one being written: from opencode
 * 1's `mcp.<name>` to opencode 2's `mcp.servers`, or back for a user who named `--opencode-config v1`
 * on a file an earlier default run wrote in the newer form.
 *
 * Moved, never copied: two entries start the server twice and the agent sees every tool twice.
 * Only the servers of the `groups` being merged are taken, because the merge is what writes them
 * back: a documentation server taken out on a `--docs none` run would simply be gone.
 *
 * An entry is ours in any form pos-cli ever wrote it — the current one, a `PREVIOUS_SERVERS` form,
 * or under its old `RENAMED_FROM` name — exactly as `mergeServers` judges it. Anything else is a
 * customisation, left alone and reported, and its server is not added in the new layout either:
 * `customised` lists `{ key, name }` so the merge can skip `name`.
 *
 * Going back to v1, an `mcp.servers` emptied by the move is removed: opencode 1 reads every key
 * under `mcp` as a server, so it would be one named "servers". One that still holds anything is
 * the user's, and is reported as `leftover`.
 */
const relocateOpencodeEntries = (fromForm) => (config, groups) => {
  const toV1 = fromForm === 'v2';
  const source = toV1 ? config.mcp?.servers : config.mcp;
  const result = { moved: [], customised: [], from: toV1 ? 'mcp.servers' : 'mcp', to: toV1 ? 'mcp' : 'mcp.servers' };
  if (!isPlainObject(source)) return result;

  for (const group of groups) {
    const other = group.build(OPENCODE_FORMS[fromForm]);
    for (const [name, server] of Object.entries(other.wanted)) {
      const ours = [other.entryOf(server), ...other.previousFor(name)];
      for (const key of [name, other.oldNameFor(name)]) {
        if (key === undefined || source[key] === undefined) continue;
        if (ours.some((form) => isDeepStrictEqual(source[key], form))) {
          delete source[key];
          result.moved.push(key === name ? name : `${key} → ${name}`);
        } else {
          result.customised.push({ key, name });
        }
      }
    }
  }

  if (toV1) {
    if (Object.keys(source).length === 0) delete config.mcp.servers;
    else result.leftover = true;
  }
  return result;
};

OPENCODE_FORMS.v2.relocate = relocateOpencodeEntries('v1');
OPENCODE_FORMS.v1.relocate = relocateOpencodeEntries('v2');

/** A TOML config file's contents; throws a one-line reason when the file does not parse. */
const parseTomlFile = (text) => {
  try {
    return parseToml(text);
  } catch (error) {
    throw new Error(`it is not valid TOML: ${String(error.message).split('\n')[0]}`);
  }
};

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
 * How a configuration write went, for the summary: `complete` when the file now registers every
 * server asked for, `incomplete` when one was left to the user (a customised entry, a file that
 * could not be edited), `refused` when nothing was written because the file could not be read.
 */
const outcome = (missing) => (missing > 0 ? 'incomplete' : 'complete');

/**
 * Codex's format, the only one here that is not JSON.
 *
 * APPEND-ONLY: re-emitting the user's TOML would reformat it and drop its comments. Tables are
 * order-independent, so an appended `[mcp_servers.<name>]` means what it would anywhere, and
 * `checked` refuses an append the file cannot take — `mcp_servers` written as an inline table, or
 * as anything but a table. An entry already there is left alone: changing it would mean editing
 * the user's lines rather than adding our own.
 */
const updateTomlConfig = async (tool, filePath, shown, groups) => {
  let result;
  try {
    result = editFile(filePath, (text) => {
      const config = parseTomlFile(text);
      const servers = config[tool.key];
      const plan = { added: [], kept: [], blocks: [] };
      const expected = structuredClone(config);
      for (const { wanted, entryOf } of groups) {
        for (const [name, server] of Object.entries(wanted)) {
          const block = tomlTable(`${tomlKey(tool.key)}.${tomlKey(name)}`, entryOf(server));
          const desired = parseToml(block)[tool.key][name];
          const existing = isTable(servers) && Object.hasOwn(servers, name) ? servers[name] : undefined;
          if (isDeepStrictEqual(existing, desired)) continue;
          // An entry defined only through a sub-table (`[mcp_servers.<name>.env]`) still takes our
          // table: TOML allows a table after its sub-tables. One sharing a key with ours is the
          // user's own registration, and is left alone.
          if (existing !== undefined && (!isTable(existing) || Object.keys(desired).some((key) => Object.hasOwn(existing, key)))) {
            plan.kept.push({ name, block });
            continue;
          }
          plan.blocks.push(block);
          plan.added.push(name);
          if (!isTable(expected[tool.key])) expected[tool.key] = {};
          expected[tool.key][name] = { ...existing, ...desired };
        }
      }
      if (plan.blocks.length === 0) return plan;
      const contents = checked(appendBlock(text, plan.blocks.join('\n\n')), expected);
      return contents === null ? { ...plan, blocked: true } : { ...plan, contents };
    });
  } catch (error) {
    await ui.error(
      `${shown} could not be updated: ${error.message}\n` + 'Fix or remove the file and run pos-cli ai init again.'
    );
    return 'refused';
  }

  for (const { name, block } of result.kept) {
    await ui.warn(`Kept your own "${name}" entry in ${shown}. pos-cli ai init would write:`);
    await ui.raw(block);
  }
  if (result.blocked) {
    await ui.warn(
      `${shown} defines ${tool.key} in a way pos-cli cannot add a table to (an inline table, most ` +
        'likely). Nothing was written to it. Merge these servers in by hand:'
    );
    await ui.raw(result.blocks.join('\n\n'));
    return 'incomplete';
  }
  if (result.added.length > 0) {
    await ui.success(`Registered MCP servers (${result.added.join(', ')}) for ${tool.label} in ${shown}`);
  } else if (result.kept.length === 0) {
    await ui.success(`${tool.label} is already configured in ${shown} - nothing to do.`);
  }
  return outcome(result.kept.length);
};

/** Reads one configuration file, merges the given groups into it, and writes it back if anything changed. */
const updateConfig = async (tool, filePath, shown, groups) => {
  let result;
  try {
    result = editFile(filePath, (text) => {
      const config = text === null ? (tool.schema ? { $schema: tool.schema } : {}) : parseJsonObject(text);

      // Before the merge, so a server that moves is written in its new place by the merge itself
      // rather than by a second write.
      const relocated = tool.relocate ? tool.relocate(config, groups) : { moved: [], customised: [] };
      const skip = new Set(relocated.customised.map(({ name }) => name));

      const servers = containerFor(config, tool.key);
      const plan = { relocated, added: [], updated: [], renamed: [], customised: [] };
      for (const group of groups) {
        const merged = mergeServers(servers, group, skip);
        for (const field of ['added', 'updated', 'renamed', 'customised']) plan[field].push(...merged[field]);
      }

      const changed = [plan.added, plan.updated, plan.renamed, relocated.moved].some((list) => list.length > 0);
      return changed ? { ...plan, contents: jsonText(config, text) } : plan;
    });
  } catch (error) {
    await ui.error(
      `${shown} could not be updated: ${error.message}\n` + 'Fix or remove the file and run pos-cli ai init again.'
    );
    return 'refused';
  }

  const { relocated, added, updated, renamed, customised } = result;
  for (const { name, desired, renamedTo } of customised) {
    await ui.warn(
      `Kept your customised "${name}" entry in ${shown}.` +
        (renamedTo ? ` That server is now registered as "${renamedTo}".` : '') +
        ` pos-cli ai init would write ${JSON.stringify(renamedTo ? { [renamedTo]: desired } : desired)}; ` +
        'merge that in by hand if you want it.'
    );
  }

  for (const { key, name } of relocated.customised) {
    await ui.warn(
      `Kept your customised "${key}" entry under ${relocated.from} in ${shown}, and did not add "${name}" ` +
        `under ${relocated.to}, so opencode does not start that server twice. Move it to ${relocated.to} ` +
        'by hand.'
    );
  }
  if (relocated.leftover) {
    await ui.warn(
      `${shown} still has an mcp.servers object, which is opencode 2's layout. opencode 1 reads it ` +
        'as a server named "servers"; move what is in it up into mcp by hand.'
    );
  }

  const missing = customised.length + relocated.customised.length;
  if (result.contents === undefined) {
    if (missing === 0) await ui.success(`${tool.label} is already configured in ${shown} - nothing to do.`);
    return outcome(missing);
  }

  if (relocated.moved.length > 0) {
    await ui.info(`Moved to ${relocated.to} in ${shown}: ${relocated.moved.join(', ')}`);
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
  return outcome(missing);
};

const announceManualGlobal = async (tool) => {
  await ui.warn(
    `pos-cli could not find a ${tool.label} user directory to write to. ${tool.globalHint}`
  );
  await ui.raw(JSON.stringify(nest(tool.key, remoteEntries(tool)), null, 2));
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

const TRUSTED = '"trusted"';

/**
 * Where `rootPath` stands in the parsed global Codex config. `key` is the spelling to edit: Codex
 * wrote it, not this repository, and Windows paths are case-insensitive — a drive letter that has
 * been through a URL comes back lower-case — so an entry already there is matched without case.
 */
const codexTrustOf = (config, rootPath, { caseInsensitive = process.platform === 'win32' } = {}) => {
  const projects = isTable(config.projects) ? config.projects : {};
  const key =
    (caseInsensitive && Object.keys(projects).find((each) => each.toLowerCase() === rootPath.toLowerCase())) || rootPath;
  const entry = Object.hasOwn(projects, key) ? projects[key] : undefined;
  return { key, entry, trusted: isTable(entry) && entry.trust_level === 'trusted' };
};

/**
 * The global config's text with the project trusted, every other line kept, or null when no edit
 * produces exactly that. Codex itself writes `[projects."<path>"]` with a `trust_level` line, and
 * that table is edited where it is; otherwise a table is appended. Anything else — an inline
 * table, a dotted key — fails `checked` and is shown to the user instead.
 */
const trustedText = (text, config, { key, entry }) => {
  const expected = structuredClone(config);
  if (!isTable(expected.projects)) expected.projects = {};
  expected.projects[key] = { ...(isTable(entry) ? entry : {}), trust_level: 'trusted' };

  const edits = [
    () => setInTable(text ?? '', ['projects', key], 'trust_level', TRUSTED),
    () => appendBlock(text, `[projects.${tomlString(key)}]\ntrust_level = ${TRUSTED}`)
  ];
  for (const edit of edits) {
    const after = checked(edit(), expected);
    if (after !== null) return after;
  }
  return null;
};

/**
 * Codex ignores a project `.codex/config.toml` until the project is trusted in the user's GLOBAL
 * config — measured on codex-cli 0.166.0, where an untrusted project showed no servers at all.
 *
 * The one place pos-cli would write outside the project, and the flag also lets project hooks
 * run, so it is asked for rather than assumed. Nothing here may fail `ai init`: the project is
 * configured by now, so every failure is reported with the lines to add by hand.
 */
const offerCodexTrust = async (tool, { rootPath, homePath, codexTrust, interactive }) => {
  const globalPath = tool.global(homePath);
  // Printed through `ui.raw`, never through a framed message: the key is the absolute path, and a
  // frame would shorten the home directory to `~`, which Codex would not match.
  const block = `[projects.${tomlString(rootPath)}]\ntrust_level = ${TRUSTED}`;
  const why = `${tool.label} ignores ${tool.file} until this project is trusted in ${globalPath}.`;
  const byHand = async (reason) => {
    await ui.warn(`${why} ${reason} Set this by hand:`);
    return ui.raw(block);
  };

  let text;
  let config;
  try {
    text = readText(globalPath);
    config = parseTomlFile(text);
  } catch (error) {
    return byHand(`pos-cli could not read it (${error.message}), so it was left alone.`);
  }
  const trust = codexTrustOf(config, rootPath);
  if (trust.trusted) return;
  // Before asking: a question whose answer cannot be honoured is worse than no question.
  if (trustedText(text, config, trust) === null) {
    return byHand('Its entry there is an inline table, or another form pos-cli does not edit.');
  }

  // `codexTrust` is `undefined` here, or `true`; `??` reads the three states directly.
  if (!(codexTrust ?? (interactive && (await promptForCodexTrust())))) {
    await ui.note(why, 'Project trust');
    await ui.info(`Add this to ${globalPath}:`);
    return ui.raw(block);
  }

  try {
    editFile(globalPath, (current) => {
      const now = parseTomlFile(current);
      const state = codexTrustOf(now, rootPath);
      if (state.trusted) return {};
      const contents = trustedText(current, now, state);
      if (contents === null) throw new Error('its entry is in a form pos-cli does not edit');
      return { contents };
    });
    await ui.success(`Marked this project trusted in ${globalPath}`);
  } catch (error) {
    await byHand(`pos-cli could not update it: ${error.message}.`);
  }
};

/** JSON for every tool but Codex, whose configuration is TOML. */
const writeConfig = (tool, ...args) => (tool.format === 'toml' ? updateTomlConfig : updateConfig)(tool, ...args);

const configureTool = async (tool, { rootPath, homePath, scope, opencodeConfig }) => {
  const groups = [localGroup(tool)];
  if (scope === 'project') groups.push(docsGroup(tool));

  const files = [{ shown: tool.file, outcome: await writeConfig(tool, path.join(rootPath, ...tool.file.split('/')), tool.file, groups) }];

  if (scope !== 'global') return { files };

  // The result, not the property: VS Code's path is searched for and may not be found.
  const globalPath = tool.global?.(homePath);
  if (!globalPath) {
    await announceManualGlobal(tool);
    return { files, docs: 'printed' };
  }

  // The global file has a form of its own: one already in the legacy shape keeps it, unless the
  // user named a form. The project file's form says nothing about a file opencode reads elsewhere.
  const globalTool = tool.forms
    ? withForm(tool, opencodeConfig || detectOpencodeForm(globalPath) || tool.form)
    : tool;
  const outcome = await writeConfig(globalTool, globalPath, globalPath, [docsGroup(globalTool)]);
  files.push({ shown: globalPath, outcome });
  return { files, docs: outcome };
};

/**
 * What the run did. The Playbook row says why nothing was installed when nothing was: "no
 * Playbook" and "one you already had" are different outcomes, and only one needs acting on.
 */
const PLAYBOOK_OUTCOME = {
  installed: (playbook, dir) => `${dir} (${playbook.files} files)`,
  exists: (_playbook, dir) => `${dir} already existed \u2014 left alone`,
  present: (_playbook, dir) => `${dir} already installed`,
  declined: () => 'not installed',
  failed: () => 'install failed \u2014 see the warning above',
  unsupported: () => undefined
};

/** Only what needs acting on is marked; `complete` is the expected case and says nothing. */
const FILE_OUTCOME = {
  incomplete: ' (not every server \u2014 see above)',
  refused: ' (not written \u2014 see above)'
};

const DOCS_ROW = { none: 'not registered', project: 'this project', global: 'all projects' };

const summaryRows = (tool, { scope, playbook, config }) => {
  const servers = [
    ...Object.keys(SERVERS),
    ...(scope === 'none' ? [] : Object.keys(DOCS_SERVERS))
  ];
  const outcome = PLAYBOOK_OUTCOME[playbook?.status ?? 'unsupported'];

  return [
    ['Tool', tool.label],
    ['Config', (config?.files ?? []).map(({ shown, outcome }) => shown + (FILE_OUTCOME[outcome] ?? '')).join(', ')],
    ['Servers', servers.map((name) => name.replace(/^platformos-/, '')).join(', ')],
    [
      'Documentation servers',
      config?.docs === 'printed'
        ? 'not registered \u2014 add them by hand, as shown above'
        : DOCS_ROW[scope] + (scope === 'global' ? (FILE_OUTCOME[config?.docs] ?? '') : '')
    ],
    ['Agent Playbook', outcome?.(playbook, tool.agentPlaybook?.dir ? `${tool.agentPlaybook.dir}/` : '')]
  ];
};

/** Never silently ignore a flag the user typed — the rule `offerAgentPlaybook` keeps too. */
const warnIgnoredFlags = async (tool, { opencodeConfig, codexTrust }) => {
  if (opencodeConfig && !tool.forms) {
    await ui.warn(`--opencode-config applies to opencode only; ignored for ${tool.label}.`);
  }
  if (codexTrust !== undefined && tool.format !== 'toml') {
    await ui.warn(`--${codexTrust ? '' : 'no-'}codex-trust applies to Codex only; ignored for ${tool.label}.`);
  }
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
  await warnIgnoredFlags(TOOLS[toolId], { opencodeConfig, codexTrust });
  if (toolId === 'other') {
    // No configuration file to write, so nothing here depends on the order the rest of `init`
    // keeps. The archive unpacks to a directory of its own and is wired up by hand.
    const playbook = await offerAgentPlaybook(TOOLS.other, { rootPath, agentPlaybook, interactive });
    await wirePlaybook(TOOLS.other, rootPath, playbook);
    await printManualSnippet(docs !== 'none');
    await ui.links(DOCS_LINKS);
    return ui.finish('Paste those servers into your tool\u2019s MCP configuration.');
  }

  // Naming a tool means "do not ask me". The documentation servers are on by default there, into
  // the project configuration; --no-docs is how a scripted run opts out.
  const scope = docs || (interactive ? await promptForDocsScope() : 'project');
  const resolved = await resolveTool(toolId, { rootPath, opencodeConfig, interactive });

  // The servers are the command's job, so they are written before the Playbook's optional download:
  // a slow network or a Ctrl-C there must not cost them. A Playbook directory that holds only the
  // config file just written (`.pi/mcp.json`) is installed around. Nothing in the Playbook steps
  // can fail the command; they catch their own errors.
  const config = await configureTool(resolved, { rootPath, homePath, scope, opencodeConfig });
  const playbook = await offerAgentPlaybook(resolved, { rootPath, agentPlaybook, interactive });
  await wirePlaybook(resolved, rootPath, playbook);
  // The one question asked after anything is written, so it comes after everything else is: a
  // Ctrl-C here then leaves a finished project and only the global trust entry undone.
  if (resolved.format === 'toml' && resolved.global) {
    await offerCodexTrust(resolved, { rootPath, homePath, codexTrust, interactive });
  }
  // Last, so it is what is left on screen: the servers just written do nothing until it is done.
  if (resolved.trustNote) await ui.note(resolved.trustNote.body, resolved.trustNote.title);

  // A scripted run has only the exit code to go by.
  if (config.files.some(({ outcome }) => outcome === 'refused')) process.exitCode = 1;
  await ui.summary(summaryRows(resolved, { scope, playbook, config }), 'Setup summary');
  await ui.links(DOCS_LINKS);
  await ui.finish(`Restart ${resolved.label} to pick up the new configuration.`);
};

export { init, SERVERS, DOCS_SERVERS, DOCS_SCOPES, PREVIOUS_SERVERS, RENAMED_FROM, TOOLS, OPENCODE_CONFIG_FORMS };
