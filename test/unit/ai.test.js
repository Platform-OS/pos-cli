import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import logger from '#lib/logger.js';
import { init, SERVERS, DOCS_SERVERS, RENAMED_FROM } from '#lib/ai.js';
import { supportsPosixPermissions, permissionsOf } from '#lib/filePermissions.js';
import { parseToml } from '#lib/tomlEdit.js';

const select = vi.fn();
vi.mock('@inquirer/prompts', () => ({ select: (...args) => select(...args) }));

const installAgentPlaybook = vi.fn(async () => ({ status: 'installed', files: 34 }));
vi.mock('#lib/agentPlaybook.js', async (importOriginal) => ({
  ...(await importOriginal()),
  installAgentPlaybook: (...args) => installAgentPlaybook(...args)
}));

const { PLAYBOOKS } = await import('#lib/agentPlaybook.js');

vi.mock('#lib/logger.js', () => ({
  default: {
    // Like the real one, it ends the run unless told not to: a mock that only records the call is
    // how a refusal that exited the process looked, under test, like one that carried on.
    Error: vi.fn((message, { exit = true } = {}) => {
      if (exit) throw new Error(`logger.Error exited: ${message}`);
    }),
    Success: vi.fn(),
    Info: vi.fn(),
    Warn: vi.fn(),
    Log: vi.fn(),
    Debug: vi.fn()
  },
  isServerMode: () => false
}));

const getTmpDir = withTmpDir();

// A refused config sets it, and vitest would read a leftover as the whole run failing.
afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs();
});

// A run with no `homePath` reads the default one — opencode's global config is a hint for the
// project's form — so the default must not be the home of whoever runs the suite.
beforeEach(() => {
  const home = path.join(getTmpDir(), 'default-home');
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('XDG_CONFIG_HOME', path.join(home, '.config'));
});

const NAME = 'platformos-cli';
const OLD_NAME = 'platformos';
const PLATFORMOS = { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] };
const SUPERVISOR = { command: 'pos-cli-supervisor' };

const writeJson = (contents, ...segments) => {
  fs.mkdirSync(path.dirname(configPath(...segments)), { recursive: true });
  fs.writeFileSync(configPath(...segments), typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
};

const configPath = (...segments) => path.join(getTmpDir(), ...segments);
const readJson = (...segments) => JSON.parse(fs.readFileSync(configPath(...segments), 'utf8'));

describe('ai init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installAgentPlaybook.mockResolvedValue({ status: 'installed', files: 34 });
  });

  test('claude - creates .mcp.json with both local servers', async () => {
    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    const config = readJson('.mcp.json');
    expect(config.mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Success).toHaveBeenCalledWith(
      'Registered MCP servers (platformos-cli, platformos-supervisor) for Claude Code in .mcp.json'
    );
  });

  test('claude - preserves unrelated keys and foreign servers', async () => {
    fs.writeFileSync(
      configPath('.mcp.json'),
      JSON.stringify({
        someOtherSetting: true,
        mcpServers: { github: { command: 'github-mcp', args: ['--stdio'] } }
      })
    );

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    const config = readJson('.mcp.json');
    expect(config.someOtherSetting).toEqual(true);
    expect(config.mcpServers.github).toEqual({ command: 'github-mcp', args: ['--stdio'] });
    expect(config.mcpServers[NAME].command).toEqual('pos-cli-mcp');
    expect(config.mcpServers['platformos-supervisor'].command).toEqual('pos-cli-supervisor');
  });

  test('claude - second run is idempotent and does not rewrite the file', async () => {
    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });
    const firstRunContent = fs.readFileSync(configPath('.mcp.json'), 'utf8');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(firstRunContent);
    expect(logger.Success).toHaveBeenLastCalledWith(expect.stringMatching(/already configured/));
  });

  // Entries earlier releases wrote: nobody chose them, so they move to the current form.
  test.each([
    ['with no arguments (6.5 and earlier)', { command: 'pos-cli-mcp' }],
    ['with the dev profile but still opening an HTTP listener', { command: 'pos-cli-mcp', args: ['--profile', 'dev'] }]
  ])('claude - upgrades an entry an earlier release wrote %s, and reports it', async (_label, earlier) => {
    writeJson({ mcpServers: { [NAME]: earlier, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Info).toHaveBeenCalledWith('Updated existing entries in .mcp.json: platformos-cli');
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos-cli) for Claude Code in .mcp.json');
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  test('vscode - upgrades the earlier entry whatever order its keys are in', async () => {
    writeJson({ servers: { [NAME]: { args: ['--profile', 'dev'], command: 'pos-cli-mcp', type: 'stdio' } } }, '.vscode', 'mcp.json');

    await init({ tool: 'vscode', docs: 'none', rootPath: getTmpDir() });

    expect(readJson('.vscode', 'mcp.json').servers[NAME]).toEqual({ type: 'stdio', ...PLATFORMOS });
    expect(logger.Info).toHaveBeenCalledWith('Updated existing entries in .vscode/mcp.json: platformos-cli');
  });

  // Someone had a reason to edit the entry; re-running init must not undo it.
  test.each([
    ['another profile', { command: 'pos-cli-mcp', args: ['--profile', 'full'] }],
    ['the HTTP listener kept on purpose', { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--exclude-tools', 'deploy-wait'] }],
    ['extra settings', { ...PLATFORMOS, env: { MCP_TOOLS_CONFIG: 'tools.json' } }],
    ['a different command', { command: 'outdated-command' }],
    ['the same args in another order', { command: 'pos-cli-mcp', args: ['dev', '--profile'] }]
  ])('claude - keeps an entry customised with %s, untouched, and says so', async (_label, customised) => {
    const original = JSON.stringify({ mcpServers: { [NAME]: customised, 'platformos-supervisor': SUPERVISOR } }, null, 2);
    writeJson(original, '.mcp.json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(original);
    expect(logger.Warn).toHaveBeenCalledWith(
      `Kept your customised "platformos-cli" entry in .mcp.json. pos-cli ai init would write ${JSON.stringify(PLATFORMOS)}; ` +
        'merge that in by hand if you want it.'
    );
    expect(logger.Success).not.toHaveBeenCalled();
    // Nothing was written, so nothing may claim otherwise. The language-server suggestion is
    // orthogonal to the MCP entry and is allowed here, which is why this names what it forbids
    // rather than forbidding Info outright.
    for (const [message] of logger.Info.mock.calls) {
      expect(message).not.toMatch(/Registered|Updated existing|Renamed entries/);
    }
  });

  test('claude - adds a missing server next to a customised one, without touching the customised one', async () => {
    const customised = { command: 'pos-cli-mcp', args: ['--profile', 'full'] };
    writeJson({ mcpServers: { [NAME]: customised } }, '.mcp.json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: customised, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos-cli" entry'));
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos-supervisor) for Claude Code in .mcp.json');
  });

  test('claude - keeps a customised supervisor entry too', async () => {
    const customised = { command: 'pos-cli-supervisor', args: ['--project', 'app'] };
    writeJson({ mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': customised } }, '.mcp.json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers['platformos-supervisor']).toEqual(customised);
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos-supervisor" entry'));
  });

  test('claude - the current entry with its keys reordered is already configured', async () => {
    const original = JSON.stringify({ mcpServers: { [NAME]: { args: ['--profile', 'dev', '--no-http'], command: 'pos-cli-mcp' }, 'platformos-supervisor': SUPERVISOR } });
    writeJson(original, '.mcp.json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(original);
    expect(logger.Success).toHaveBeenCalledWith('Claude Code is already configured in .mcp.json - nothing to do.');
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  describe('the rename from platformos to platformos-cli', () => {
    // Two entries for one server would start it twice and show the agent every tool twice.
    test.each([
      ['the current form', PLATFORMOS],
      ['a form an earlier release wrote', { command: 'pos-cli-mcp' }],
      ['the dev profile without --no-http', { command: 'pos-cli-mcp', args: ['--profile', 'dev'] }]
    ])('renames an entry pos-cli wrote (%s), leaving nothing behind', async (_label, existing) => {
      writeJson({ mcpServers: { [OLD_NAME]: existing, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
      expect(logger.Info).toHaveBeenCalledWith('Renamed entries in .mcp.json: platformos → platformos-cli');
      expect(logger.Warn).not.toHaveBeenCalled();
    });

    // A config file is committed and read by people, so the entry keeps its place.
    test('renames in place, keeping the order of every other server', async () => {
      writeJson({
        mcpServers: {
          github: { command: 'github-mcp' },
          [OLD_NAME]: { command: 'pos-cli-mcp' },
          'platformos-supervisor': SUPERVISOR,
          sentry: { command: 'sentry-mcp' }
        }
      }, '.mcp.json');

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual(['github', NAME, 'platformos-supervisor', 'sentry']);
    });

    test('renames in VS Code too, where the entry carries a type', async () => {
      writeJson({ servers: { [OLD_NAME]: { type: 'stdio', command: 'pos-cli-mcp' } } }, '.vscode', 'mcp.json');

      await init({ tool: 'vscode', docs: 'none', rootPath: getTmpDir() });

      expect(readJson('.vscode', 'mcp.json').servers).toEqual({
        [NAME]: { type: 'stdio', ...PLATFORMOS },
        'platformos-supervisor': { type: 'stdio', ...SUPERVISOR }
      });
    });

    // Adding platformos-cli beside a customised old entry would run their server and ours at once.
    test('leaves a customised entry under the old name alone, and adds no second one', async () => {
      const customised = { command: 'pos-cli-mcp', args: ['--profile', 'full'], env: { MCP_TOOLS_CONFIG: 'tools.json' } };
      writeJson({ mcpServers: { [OLD_NAME]: customised } }, '.mcp.json');

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      const servers = readJson('.mcp.json').mcpServers;
      expect(servers[OLD_NAME]).toEqual(customised);
      expect(servers[NAME]).toBeUndefined();
      expect(logger.Warn).toHaveBeenCalledWith(
        `Kept your customised "${OLD_NAME}" entry in .mcp.json. That server is now registered as "${NAME}". ` +
          `pos-cli ai init would write ${JSON.stringify({ [NAME]: PLATFORMOS })}; merge that in by hand if you want it.`
      );
    });

    test('an entry left under both names loses the old one', async () => {
      writeJson({ mcpServers: { [OLD_NAME]: { command: 'pos-cli-mcp' }, [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
      expect(logger.Info).toHaveBeenCalledWith('Renamed entries in .mcp.json: platformos (removed; platformos-cli is the entry now)');
    });

    test('a customised old entry kept beside the new one is not removed', async () => {
      const customised = { command: 'node', args: ['./local/pos-cli-mcp.js'] };
      writeJson({ mcpServers: { [OLD_NAME]: customised, [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      expect(readJson('.mcp.json').mcpServers[OLD_NAME]).toEqual(customised);
    });

    test('a rename is written once: the next run has nothing to do', async () => {
      writeJson({ mcpServers: { [OLD_NAME]: { command: 'pos-cli-mcp' } } }, '.mcp.json');
      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });
      const afterRename = fs.readFileSync(configPath('.mcp.json'), 'utf8');
      vi.clearAllMocks();

      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

      expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(afterRename);
      expect(logger.Success).toHaveBeenCalledWith('Claude Code is already configured in .mcp.json - nothing to do.');
    });

    test('the supervisor is not renamed: only the pos-cli server was', async () => {
      expect(RENAMED_FROM).toEqual({ [NAME]: OLD_NAME });
      expect(Object.keys(SERVERS)).toEqual([NAME, 'platformos-supervisor']);
    });
  });

  test('cursor - creates .cursor/mcp.json', async () => {
    await init({ tool: 'cursor', docs: 'none', rootPath: getTmpDir() });

    const config = readJson('.cursor', 'mcp.json');
    expect(config.mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
  });

  test('vscode - creates .vscode/mcp.json with servers key and stdio type', async () => {
    await init({ tool: 'vscode', docs: 'none', rootPath: getTmpDir() });

    const config = readJson('.vscode', 'mcp.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.servers[NAME]).toEqual({ type: 'stdio', command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] });
    expect(config.servers['platformos-supervisor']).toEqual({ type: 'stdio', command: 'pos-cli-supervisor' });
  });

  test('other - writes no files and prints the snippet', async () => {
    await init({ tool: 'other', docs: 'none', rootPath: getTmpDir() });

    expect(fs.readdirSync(getTmpDir())).toEqual([]);
    expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
      mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR }
    });
  });

  test('claude - aborts on invalid JSON without touching the file', async () => {
    fs.writeFileSync(configPath('.mcp.json'), '{ not valid json');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/), { exit: false, notify: false });
    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual('{ not valid json');
  });

  // Each of these parses, and each would take the servers somewhere JSON.stringify drops them, or
  // throw half way through — while the run reported success.
  test.each([
    ['a list at the top level', '[]'],
    ['null at the top level', 'null'],
    ['mcpServers as a string', '{"mcpServers": "x"}'],
    ['mcpServers as a list', '{"mcpServers": []}']
  ])('claude - a config with %s is refused and left as it was', async (_label, mine) => {
    fs.writeFileSync(configPath('.mcp.json'), mine);

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toBe(mine);
    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/could not be updated/), { exit: false, notify: false });
    expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/\.mcp\.json \(not written/));
    expect(process.exitCode).toBe(1);
  });

  test('claude - a byte-order mark is read past and kept', async () => {
    fs.writeFileSync(configPath('.mcp.json'), '\uFEFF{"mcpServers": {}}');

    await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir() });

    const text = fs.readFileSync(configPath('.mcp.json'), 'utf8');
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(JSON.parse(text.slice(1)).mcpServers[NAME]).toEqual(PLATFORMOS);
  });

  test('a flag for another tool is reported as ignored, not dropped in silence', async () => {
    await init({ tool: 'claude', docs: 'none', opencodeConfig: 'v1', codexTrust: false, rootPath: getTmpDir() });

    expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/--opencode-config applies to opencode only/));
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/--no-codex-trust applies to Codex only/));
  });

  // The hosted documentation servers: public Liquid and GraphQL reference, no credentials.
  describe('the documentation servers', () => {
    const LIQUID = 'platformos-liquid';
    const GRAPHQL = 'platformos-graphql';
    const LIQUID_URL = 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp';
    const GRAPHQL_URL = 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp';

    const CLAUDE_DOCS = {
      [LIQUID]: { type: 'http', url: LIQUID_URL },
      [GRAPHQL]: { type: 'http', url: GRAPHQL_URL }
    };

    const homeDir = () => path.join(getTmpDir(), 'home');
    const atHome = (...segments) => path.join(homeDir(), ...segments);
    const readHome = (...segments) => JSON.parse(fs.readFileSync(atHome(...segments), 'utf8'));

    // Both are read at call time, so a value on the developer's machine would send the opencode
    // or VS Code global write outside the temporary home this suite redirects to.
    beforeEach(() => {
      vi.stubEnv('XDG_CONFIG_HOME', undefined);
      vi.stubEnv('APPDATA', undefined);
    });
    afterEach(() => vi.unstubAllEnvs());

    // Where this platform's VS Code builds live, under the temporary home.
    const vscodeUserDir = (build) =>
      process.platform === 'win32'
        ? atHome('AppData', 'Roaming', build, 'User')
        : process.platform === 'darwin'
          ? atHome('Library', 'Application Support', build, 'User')
          : atHome('.config', build, 'User');

    test('the published endpoints are the two documented ones, over https', () => {
      expect(DOCS_SERVERS).toEqual({ [LIQUID]: { url: LIQUID_URL }, [GRAPHQL]: { url: GRAPHQL_URL } });
    });

    // The decision in TASK-68: naming a tool means "take the defaults without asking", and the
    // default answer is yes. --no-docs is how a scripted run opts out.
    test('claude - --tool with no documentation flag registers them in the project file', async () => {
      await init({ tool: 'claude', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('.mcp.json').mcpServers).toEqual({
        [NAME]: PLATFORMOS,
        'platformos-supervisor': SUPERVISOR,
        ...CLAUDE_DOCS
      });
      expect(fs.existsSync(homeDir())).toBe(false);
    });

    test('claude - docs none registers the local servers and neither documentation server', async () => {
      await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const servers = readJson('.mcp.json').mcpServers;
      expect(Object.keys(servers)).toEqual([NAME, 'platformos-supervisor']);
    });

    test('claude - docs global keeps the project file local-only and writes ~/.claude.json', async () => {
      await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual([NAME, 'platformos-supervisor']);
      expect(readHome('.claude.json').mcpServers).toEqual(CLAUDE_DOCS);
    });

    // ~/.claude.json is Claude Code's own file: it holds the project history and session state,
    // and pos-cli only has business with mcpServers.
    test('claude - a global write preserves every other key in ~/.claude.json', async () => {
      const existing = {
        numStartups: 42,
        projects: { '/somewhere/else': { allowedTools: ['Bash'], history: [{ display: 'hi' }] } },
        mcpServers: { github: { command: 'github-mcp' } },
        oauthAccount: { emailAddress: 'someone@example.com' }
      };
      fs.mkdirSync(homeDir(), { recursive: true });
      fs.writeFileSync(atHome('.claude.json'), JSON.stringify(existing, null, 2));

      await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      const after = readHome('.claude.json');
      expect(after.numStartups).toEqual(42);
      expect(after.projects).toEqual(existing.projects);
      expect(after.oauthAccount).toEqual(existing.oauthAccount);
      expect(after.mcpServers).toEqual({ github: { command: 'github-mcp' }, ...CLAUDE_DOCS });
    });

    test('cursor - the global file is ~/.cursor/mcp.json and the remote entry is a bare url', async () => {
      await init({ tool: 'cursor', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readHome('.cursor', 'mcp.json').mcpServers).toEqual({
        [LIQUID]: { url: LIQUID_URL },
        [GRAPHQL]: { url: GRAPHQL_URL }
      });
    });

    // VS Code's user directory is per-build, so pos-cli searches for one rather than guessing.
    // With no build installed there is nothing to write, and the servers are printed instead.
    test('vscode - docs global with no build installed writes nothing outside the project', async () => {
      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.existsSync(homeDir())).toBe(false);
      expect(Object.keys(readJson('.vscode', 'mcp.json').servers)).toEqual([NAME, 'platformos-supervisor']);
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('MCP: Open User Configuration'));
      expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
        servers: { [LIQUID]: { type: 'http', url: LIQUID_URL }, [GRAPHQL]: { type: 'http', url: GRAPHQL_URL } }
      });
    });

    test('vscode - docs global writes into the build directory that exists', async () => {
      fs.mkdirSync(vscodeUserDir('Code'), { recursive: true });

      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      const global = JSON.parse(fs.readFileSync(path.join(vscodeUserDir('Code'), 'mcp.json'), 'utf8'));
      expect(global.servers).toEqual({
        [LIQUID]: { type: 'http', url: LIQUID_URL },
        [GRAPHQL]: { type: 'http', url: GRAPHQL_URL }
      });
      expect(logger.Warn).not.toHaveBeenCalled();
    });

    // VS Code reads these files as JSON with comments. Strict parsing refused them, and rewriting
    // them would drop the comments.
    test('vscode - a global file with comments and trailing commas is edited, comments kept', async () => {
      fs.mkdirSync(vscodeUserDir('Code'), { recursive: true });
      const file = path.join(vscodeUserDir('Code'), 'mcp.json');
      fs.writeFileSync(file, '{\n  // my servers\n  "servers": {\n    "mine": { "url": "https://example.com" },\n  },\n}\n');

      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      const text = fs.readFileSync(file, 'utf8');
      expect(text).toContain('// my servers');
      const { parse } = await import('jsonc-parser');
      expect(parse(text, [], { allowTrailingComma: true }).servers).toEqual({
        mine: { url: 'https://example.com' },
        [LIQUID]: { type: 'http', url: LIQUID_URL },
        [GRAPHQL]: { type: 'http', url: GRAPHQL_URL }
      });
      expect(logger.Error).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    // Only a directory that is already there: writing a path no installed build reads would look
    // like a success and do nothing.
    test('vscode - docs global never creates a build directory of its own', async () => {
      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.existsSync(vscodeUserDir('Code'))).toBe(false);
    });

    test('vscode - docs global finds an Insiders or VSCodium directory too', async () => {
      fs.mkdirSync(vscodeUserDir('VSCodium'), { recursive: true });

      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      const global = JSON.parse(fs.readFileSync(path.join(vscodeUserDir('VSCodium'), 'mcp.json'), 'utf8'));
      expect(Object.keys(global.servers)).toEqual([LIQUID, GRAPHQL]);
    });

    test('vscode - docs project still writes them into .vscode/mcp.json', async () => {
      await init({ tool: 'vscode', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('.vscode', 'mcp.json').servers[LIQUID]).toEqual({ type: 'http', url: LIQUID_URL });
    });

    test('opencode - project file uses mcp.servers, a command array and type local', async () => {
      await init({ tool: 'opencode', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.$schema).toEqual('https://opencode.ai/config.json');
      expect(config.mcpServers).toBeUndefined();
      expect(config.mcp).toEqual({
        servers: {
          [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'] },
          'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'] },
          [LIQUID]: { type: 'remote', url: LIQUID_URL },
          [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL }
        }
      });
    });

    test('opencode - --opencode-config v1 writes the legacy shape instead', async () => {
      await init({
        tool: 'opencode',
        docs: 'project',
        opencodeConfig: 'v1',
        rootPath: getTmpDir(),
        homePath: homeDir()
      });

      expect(readJson('opencode.json').mcp).toEqual({
        [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
        'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true },
        [LIQUID]: { type: 'remote', url: LIQUID_URL, enabled: true },
        [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL, enabled: true }
      });
    });

    test('opencode - a file already using the legacy shape keeps it', async () => {
      writeJson({ mcp: { 'something-else': { type: 'local', command: ['x'], enabled: true } } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp.servers).toBeUndefined();
      expect(config.mcp[NAME]).toEqual({
        type: 'local',
        command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'],
        enabled: true
      });
    });

    test('opencode - a file already using mcp.servers keeps that', async () => {
      writeJson({ mcp: { servers: { 'something-else': { type: 'local', command: ['x'] } } } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp[NAME]).toBeUndefined();
      expect(config.mcp.servers[NAME]).toEqual({
        type: 'local',
        command: ['pos-cli-mcp', '--profile', 'dev', '--no-http']
      });
    });

    // A default run writes v2; an opencode 1 user who then names v1 must not end up with the servers
    // twice, and with an `mcp.servers` that opencode 1 reads as a server named "servers".
    test('opencode - --opencode-config v1 moves entries pos-cli wrote under mcp.servers back', async () => {
      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });
      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v1', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('opencode.json').mcp).toEqual({
        [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
        'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true }
      });
    });

    test('opencode - an mcp.servers still holding the user\'s own servers is kept, and named', async () => {
      writeJson({ mcp: { servers: { mine: { type: 'local', command: ['x'] } } } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v1', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('opencode.json').mcp.servers).toEqual({ mine: { type: 'local', command: ['x'] } });
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/opencode 1 reads it\s+as a server named "servers"/));
    });

    test('opencode - an entry pos-cli wrote under the legacy key is moved, not duplicated', async () => {
      writeJson(
        {
          mcp: {
            [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
            servers: {}
          }
        },
        'opencode.json'
      );

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp[NAME]).toBeUndefined();
      expect(config.mcp.servers[NAME]).toEqual({
        type: 'local',
        command: ['pos-cli-mcp', '--profile', 'dev', '--no-http']
      });
    });

    // The legacy entries of a group this run does not merge are not taken out: nothing would
    // write them back, and "moved" would be a report of a deletion.
    test('opencode - --docs none moves the local servers and leaves the documentation ones', async () => {
      writeJson(
        {
          mcp: {
            [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
            'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true },
            [LIQUID]: { type: 'remote', url: LIQUID_URL, enabled: true },
            [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL, enabled: true }
          }
        },
        'opencode.json'
      );

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v2', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(Object.keys(config.mcp.servers)).toEqual([NAME, 'platformos-supervisor']);
      expect(config.mcp[LIQUID]).toEqual({ type: 'remote', url: LIQUID_URL, enabled: true });
      expect(config.mcp[GRAPHQL]).toEqual({ type: 'remote', url: GRAPHQL_URL, enabled: true });
      expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/Moved to mcp\.servers.*: platformos-cli, platformos-supervisor$/));
    });

    test('opencode - an entry an older pos-cli wrote under the legacy key is moved, under any name it had', async () => {
      writeJson(
        { mcp: { [OLD_NAME]: { type: 'local', command: ['pos-cli-mcp'], enabled: true } } },
        'opencode.json'
      );

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v2', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(Object.keys(config.mcp)).toEqual(['servers']);
      expect(config.mcp.servers[NAME]).toEqual({ type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'] });
      expect(logger.Warn).not.toHaveBeenCalled();
    });

    test('opencode - a legacy global file keeps the legacy shape when no form was named', async () => {
      fs.mkdirSync(atHome('.config', 'opencode'), { recursive: true });
      fs.writeFileSync(
        atHome('.config', 'opencode', 'opencode.json'),
        JSON.stringify({ mcp: { other: { type: 'local', command: ['x'], enabled: true } } })
      );
      writeJson({ mcp: { servers: {} } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('opencode.json').mcp.servers).toBeDefined();
      const global = readHome('.config', 'opencode', 'opencode.json');
      expect(global.mcp.servers).toBeUndefined();
      expect(global.mcp[LIQUID]).toEqual({ type: 'remote', url: LIQUID_URL, enabled: true });
    });

    // The project has no file yet; the global one was written by the opencode the user runs.
    test('opencode - a project with no file takes the form of the global config', async () => {
      fs.mkdirSync(atHome('.config', 'opencode'), { recursive: true });
      fs.writeFileSync(
        atHome('.config', 'opencode', 'opencode.json'),
        JSON.stringify({ mcp: { other: { type: 'local', command: ['x'], enabled: true } } })
      );

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp.servers).toBeUndefined();
      expect(config.mcp[NAME]).toEqual({ type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true });
    });

    test('opencode - a byte-order mark does not hide the form a file uses', async () => {
      writeJson('\uFEFF' + JSON.stringify({ mcp: { other: { type: 'local', command: ['x'], enabled: true } } }), 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = JSON.parse(fs.readFileSync(configPath('opencode.json'), 'utf8').replace(/^\uFEFF/, ''));
      expect(config.mcp.servers).toBeUndefined();
      expect(config.mcp[NAME]).toBeDefined();
    });

    // The old name customised and the new one ours: the server stays where it is, both entries
    // with it. Moving ours left it in a layout the merge then skipped, so it was simply deleted.
    test('opencode - an entry of ours beside a customised old-name entry is not deleted', async () => {
      const ours = { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true };
      writeJson({ mcp: { [OLD_NAME]: { type: 'local', command: ['my-wrapper'] }, [NAME]: ours } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v2', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp[NAME]).toEqual(ours);
      expect(config.mcp[OLD_NAME]).toEqual({ type: 'local', command: ['my-wrapper'] });
      expect(config.mcp.servers[NAME]).toBeUndefined();
      expect(logger.Info).not.toHaveBeenCalledWith(expect.stringMatching(/Moved to .*platformos-cli/));
    });

    test('opencode - a customised legacy entry is kept and reported', async () => {
      writeJson(
        { mcp: { [NAME]: { type: 'local', command: ['my-own-wrapper'] }, servers: {} } },
        'opencode.json'
      );

      await init({ tool: 'opencode', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp[NAME]).toEqual({ type: 'local', command: ['my-own-wrapper'] });
      // Not added beside it: two entries start the server twice.
      expect(config.mcp.servers[NAME]).toBeUndefined();
      expect(config.mcp.servers['platformos-supervisor']).toBeDefined();
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/start that server twice/));
    });

    test('opencode - a customised mcp.servers entry is not duplicated under mcp going back to v1', async () => {
      writeJson({ mcp: { servers: { [NAME]: { type: 'local', command: ['mine'] } } } }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v1', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.mcp.servers[NAME]).toEqual({ type: 'local', command: ['mine'] });
      expect(config.mcp[NAME]).toBeUndefined();
    });

    test('opencode - an "instructions" that is not a list is never replaced', async () => {
      writeJson({ instructions: 'MINE.md' }, 'opencode.json');
      const dir = path.join(getTmpDir(), '.opencode');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'rules.md'), 'rules');
      fs.writeFileSync(path.join(dir, 'playbook.json'), JSON.stringify({ instructions: ['.opencode/rules.md'] }));

      await init({ tool: 'opencode', docs: 'none', opencodeConfig: 'v2', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('opencode.json').instructions).toBe('MINE.md');
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/"instructions" is not a list/));
    });

    test('opencode - the global file is ~/.config/opencode/opencode.json', async () => {
      await init({ tool: 'opencode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(Object.keys(readJson('opencode.json').mcp.servers)).toEqual([NAME, 'platformos-supervisor']);
      expect(readHome('.config', 'opencode', 'opencode.json').mcp).toEqual({
        servers: {
          [LIQUID]: { type: 'remote', url: LIQUID_URL },
          [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL }
        }
      });
    });

    test('opencode - XDG_CONFIG_HOME decides where the global file goes', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', path.join(getTmpDir(), 'xdg'));

      await init({ tool: 'opencode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.existsSync(path.join(getTmpDir(), 'xdg', 'opencode', 'opencode.json'))).toBe(true);
      expect(fs.existsSync(atHome('.config'))).toBe(false);
    });

    test('an existing opencode.json keeps the $schema it already had', async () => {
      writeJson({ $schema: 'https://example.com/other.json', model: 'anthropic/claude' }, 'opencode.json');

      await init({ tool: 'opencode', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.$schema).toEqual('https://example.com/other.json');
      expect(config.model).toEqual('anthropic/claude');
    });

    test('a documentation entry edited by hand is kept, and reported', async () => {
      const customised = { type: 'http', url: LIQUID_URL, headers: { 'X-Trace': 'on' } };
      writeJson({ mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR, [LIQUID]: customised } }, '.mcp.json');

      await init({ tool: 'claude', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('.mcp.json').mcpServers[LIQUID]).toEqual(customised);
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining(`Kept your customised "${LIQUID}" entry`));
      expect(readJson('.mcp.json').mcpServers[GRAPHQL]).toEqual({ type: 'http', url: GRAPHQL_URL });
    });

    test.each([
      ['project', '.mcp.json'],
      ['global', null]
    ])('a second run with docs %s has nothing to do', async (scope, _file) => {
      await init({ tool: 'claude', docs: scope, rootPath: getTmpDir(), homePath: homeDir() });
      const project = fs.readFileSync(configPath('.mcp.json'), 'utf8');
      const global = scope === 'global' ? fs.readFileSync(atHome('.claude.json'), 'utf8') : null;
      vi.clearAllMocks();

      await init({ tool: 'claude', docs: scope, rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(project);
      if (global !== null) expect(fs.readFileSync(atHome('.claude.json'), 'utf8')).toEqual(global);
      expect(logger.Success).toHaveBeenCalledWith(expect.stringMatching(/already configured/));
      expect(logger.Success).not.toHaveBeenCalledWith(expect.stringMatching(/^Registered MCP servers/));
    });

    test('other - the snippet carries the documentation servers too', async () => {
      await init({ tool: 'other', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.readdirSync(getTmpDir())).toEqual([]);
      expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
        mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR, ...CLAUDE_DOCS }
      });
    });

    test('other - --no-docs leaves them out of the snippet', async () => {
      await init({ tool: 'other', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
        mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR }
      });
    });

    test('a global write to a file that is not valid JSON changes nothing', async () => {
      fs.mkdirSync(homeDir(), { recursive: true });
      fs.writeFileSync(atHome('.claude.json'), '{ not valid json');

      await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.readFileSync(atHome('.claude.json'), 'utf8')).toEqual('{ not valid json');
      expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/), { exit: false, notify: false });
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
      // The project file is written first and is a separate decision, so it still has the locals.
      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual([NAME, 'platformos-supervisor']);
    });

    // The write is done beside the target and renamed on, so a reader never sees half a file.
    // What that costs is a temporary file, and a failed write must not leave one behind.
    test('a write that fails part way leaves no temporary file behind', async () => {
      const renameSync = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        const error = new Error('EXDEV: cross-device link not permitted');
        error.code = 'EXDEV';
        throw error;
      });

      try {
        await init({ tool: 'claude', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

        expect(renameSync).toHaveBeenCalled();
        expect(fs.readdirSync(getTmpDir())).toEqual([]);
        // Reported, and a scripted run is told it failed, rather than a stack trace.
        expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/EXDEV/), { exit: false, notify: false });
        expect(process.exitCode).toBe(1);
      } finally {
        renameSync.mockRestore();
        process.exitCode = undefined;
      }
    });

    // Claude Code rewrites ~/.claude.json while it runs, and `ai init` is often run inside it.
    test('a global file changed during the write is merged again, not overwritten', async () => {
      fs.mkdirSync(homeDir(), { recursive: true });
      fs.writeFileSync(atHome('.claude.json'), JSON.stringify({ numStartups: 1 }));
      const realWrite = fs.writeFileSync;
      let raced = false;
      const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation((file, ...rest) => {
        if (!raced && String(file).includes('.claude.json.pos-cli-')) {
          raced = true;
          realWrite(atHome('.claude.json'), JSON.stringify({ numStartups: 2 }));
        }
        return realWrite(file, ...rest);
      });

      try {
        await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });
      } finally {
        spy.mockRestore();
      }

      const config = JSON.parse(fs.readFileSync(atHome('.claude.json'), 'utf8'));
      expect(raced).toBe(true);
      expect(config.numStartups).toBe(2);
      expect(Object.keys(config.mcpServers)).toEqual(Object.keys(DOCS_SERVERS));
    });

    test('vscode - the summary does not claim documentation servers it only printed', async () => {
      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/Documentation servers\s+not registered/));
    });

    test('no temporary file is left beside a config pos-cli wrote', async () => {
      await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.readdirSync(getTmpDir()).filter(name => name.includes('.tmp'))).toEqual([]);
      expect(fs.readdirSync(homeDir()).filter(name => name.includes('.tmp'))).toEqual([]);
    });
  });


  describe("the Agent Playbook", () => {
    const kitPath = () => path.join(getTmpDir(), ".claude");

    test("--agent-playbook installs it without asking", async () => {
      await init({ tool: "claude", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.claude });
      expect(select).not.toHaveBeenCalled();
      expect(logger.Success).toHaveBeenCalledWith(
        "Installed the platformOS Agent Playbook (34 files) in .claude/"
      );
    });

    test("--no-agent-playbook never asks and never installs", async () => {
      select.mockResolvedValueOnce("claude").mockResolvedValueOnce("none");

      await init({ agentPlaybook: false, rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
      const asked = select.mock.calls.map(call => call[0].message);
      expect(asked.some(message => /Agent Playbook/.test(message))).toBe(false);
      expect(asked).toHaveLength(2);
    });

    // Naming --tool means "do not ask me", so the kit needs its own flag there.
    test("--tool alone neither asks nor installs", async () => {
      await init({ tool: "claude", docs: "none", rootPath: getTmpDir() });

      expect(select).not.toHaveBeenCalled();
      expect(installAgentPlaybook).not.toHaveBeenCalled();
    });

    test("answering the interactive question installs it", async () => {
      select.mockResolvedValueOnce("claude").mockResolvedValueOnce("none").mockResolvedValueOnce(true);

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.claude });
    });

    test("declining the interactive question does not install it", async () => {
      select.mockResolvedValueOnce("claude").mockResolvedValueOnce("none").mockResolvedValueOnce(false);

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
    });

    // VS Code has native path-scoped instructions of its own, but under two different agent
    // harnesses with different support, so no archive is offered for it yet.
    test("is never offered for vscode, even interactively", async () => {
      select.mockResolvedValueOnce("vscode").mockResolvedValueOnce("none");

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledTimes(2);
    });

    // Cursor attaches a `.cursor/rules/*.mdc` rule itself when a matching file is in context, so
    // its archive needs no plugin and the Playbook is worth offering.
    test("cursor is offered its own Playbook, and installs .cursor/", async () => {
      select.mockResolvedValueOnce("cursor").mockResolvedValueOnce("none").mockResolvedValueOnce(true);

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).toHaveBeenCalledWith({
        rootPath: getTmpDir(),
        playbook: PLAYBOOKS.cursor,
        keep: ['mcp.json']
      });
      expect(select).toHaveBeenCalledTimes(3);
    });

    // Cursor's MCP file lives INSIDE the Playbook's directory, as pi's and Codex's do. The servers
    // are the command's job, so they are written first — a slow download or a Ctrl-C must not cost
    // them — and the Playbook is installed around the file they were written to.
    test("cursor - .cursor/mcp.json is written before the Playbook download, which keeps it", async () => {
      const order = [];
      installAgentPlaybook.mockImplementation(async ({ rootPath, keep }) => {
        order.push(`playbook:${fs.existsSync(path.join(rootPath, '.cursor', 'mcp.json')) ? 'config-written' : 'fresh'}`);
        order.push(`keep:${keep}`);
        return { status: 'installed', files: 26 };
      });

      await init({ tool: 'cursor', docs: 'none', agentPlaybook: true, rootPath: getTmpDir() });

      expect(order).toEqual(['playbook:config-written', 'keep:mcp.json']);
      expect(readJson('.cursor', 'mcp.json').mcpServers[NAME]).toEqual(PLATFORMOS);
    });

    // The portable archive assumes no mechanism at all, which is what makes it the right one for
    // a tool pos-cli has no wiring for.
    test("Other is offered the portable Playbook", async () => {
      select.mockResolvedValueOnce("other").mockResolvedValueOnce(true);

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.portable });
    });

    // Nothing reads the portable directory on its own, so an install that does not say so looks
    // exactly like one that worked. Same reason pi's trust note exists.
    test("Other is told the portable Playbook still has to be wired up", async () => {
      await init({ tool: "other", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(logger.Info).toHaveBeenCalledWith(
        expect.stringMatching(/Nothing reads platformos-playbook\/ until you point your tool at it/)
      );
    });

    test("pi is still told about its trust gate", async () => {
      await init({ tool: "pi", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/^Project trust: pi ignores everything in \.pi\//));
    });

    test("opencode is offered its own Playbook, and installs .opencode/", async () => {
      // tool, docs scope, opencode config form, then the Playbook question
      select
        .mockResolvedValueOnce("opencode")
        .mockResolvedValueOnce("none")
        .mockResolvedValueOnce("v2")
        .mockResolvedValueOnce(true);

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).toHaveBeenCalledWith({
        rootPath: getTmpDir(),
        playbook: PLAYBOOKS.opencode
      });
    });

    test("the opencode Playbook registers its instruction files in opencode.json", async () => {
      installAgentPlaybook.mockResolvedValue({
        status: "installed",
        files: 30,
        manifest: { instructions: [".opencode/platformos-attitude.md", ".opencode/rules/00-project-rules.md"] }
      });

      await init({
        tool: "opencode",
        docs: "none",
        agentPlaybook: true,
        opencodeConfig: "v2",
        rootPath: getTmpDir()
      });

      expect(readJson("opencode.json").instructions).toEqual([
        ".opencode/platformos-attitude.md",
        ".opencode/rules/00-project-rules.md"
      ]);
    });

    test("a fresh opencode.json written alongside the Playbook still gets its $schema", async () => {
      installAgentPlaybook.mockResolvedValue({
        status: "installed",
        files: 30,
        manifest: { instructions: [".opencode/platformos-attitude.md"] }
      });

      await init({ tool: "opencode", docs: "none", agentPlaybook: true, opencodeConfig: "v2", rootPath: getTmpDir() });

      const config = readJson("opencode.json");
      expect(config.$schema).toBe("https://opencode.ai/config.json");
      expect(config.instructions).toEqual([".opencode/platformos-attitude.md"]);
      expect(config.mcp.servers[NAME]).toBeDefined();
    });

    // The Playbook is installed by then, so a config it could not be wired into is its own
    // warning, not "could not install".
    test("a config that cannot be wired is not reported as a failed install", async () => {
      installAgentPlaybook.mockResolvedValue({
        status: "installed",
        files: 30,
        manifest: { instructions: [".opencode/platformos-attitude.md"] }
      });
      const real = fs.renameSync;
      let calls = 0;
      const renameSync = vi.spyOn(fs, "renameSync").mockImplementation((...args) => {
        // The first write is the servers; the second is the instructions.
        if (++calls === 2) throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
        return real(...args);
      });

      try {
        await init({ tool: "opencode", docs: "none", agentPlaybook: true, opencodeConfig: "v2", rootPath: getTmpDir() });
      } finally {
        renameSync.mockRestore();
      }

      const warnings = vi.mocked(logger.Warn).mock.calls.map(([message]) => message);
      expect(warnings).toEqual([expect.stringMatching(/Could not register the Playbook's instruction files.*EACCES/s)]);
      expect(vi.mocked(logger.Info).mock.calls.at(-3)[0]).toMatch(/Agent Playbook\s+\.opencode\/ \(30 files\)/);
    });

    test("instruction files the user already listed are not duplicated", async () => {
      writeJson({ instructions: [".opencode/platformos-attitude.md", "CONTRIBUTING.md"] }, "opencode.json");
      installAgentPlaybook.mockResolvedValue({
        status: "installed",
        files: 30,
        manifest: { instructions: [".opencode/platformos-attitude.md", ".opencode/rules/00-project-rules.md"] }
      });

      await init({
        tool: "opencode",
        docs: "none",
        agentPlaybook: true,
        opencodeConfig: "v2",
        rootPath: getTmpDir()
      });

      expect(readJson("opencode.json").instructions).toEqual([
        ".opencode/platformos-attitude.md",
        "CONTRIBUTING.md",
        ".opencode/rules/00-project-rules.md"
      ]);
    });

    test("an archive carrying no manifest writes no instructions", async () => {
      installAgentPlaybook.mockResolvedValue({ status: "installed", files: 30, manifest: null });

      await init({
        tool: "opencode",
        docs: "none",
        agentPlaybook: true,
        opencodeConfig: "v2",
        rootPath: getTmpDir()
      });

      expect(readJson("opencode.json").instructions).toBeUndefined();
    });

    // A flag the user typed is never silently ignored.
    test("--agent-playbook with another tool says why it was skipped", async () => {
      await init({ tool: "vscode", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
      const warning = vi.mocked(logger.Warn).mock.calls.at(-1)[0];
      expect(warning).toMatch(/VS Code reads none of them/);

      // One readable list however many runners support the Playbook: commas between, "and"
      // only before the last. Joining them all with " and " is what this pins.
      const list = /available for (.+?), each in that tool's own/.exec(warning)[1];
      expect(list.match(/ and /g)).toHaveLength(1);
      expect(list).toContain(', ');
      // "Other" is not a tool, and the archive it installs is not "that tool's own directory".
      expect(list).not.toContain('Other');
      // The one thing a VS Code user can actually act on.
      expect(warning).toContain(PLAYBOOKS.portable.url);
    });

    test("an existing .claude\/ is left alone, and not asked about", async () => {
      fs.mkdirSync(kitPath(), { recursive: true });
      fs.writeFileSync(path.join(kitPath(), "CLAUDE.md"), "mine");
      select.mockResolvedValueOnce("claude").mockResolvedValueOnce("none");

      await init({ rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledTimes(2);
      expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/already has a \.claude\/ directory/));
      expect(fs.readFileSync(path.join(kitPath(), "CLAUDE.md"), "utf8")).toBe("mine");
    });

    // A run that stopped after unpacking — at a config that would not parse, at a Ctrl-C — left a
    // Playbook nothing had wired. The directory is there now, so only wiring it here can finish it.
    test("a Playbook already in place is wired on a later run", async () => {
      const dir = path.join(getTmpDir(), ".opencode");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "rules.md"), "rules");
      fs.writeFileSync(path.join(dir, "playbook.json"), JSON.stringify({ instructions: [".opencode/rules.md"] }));

      await init({ tool: "opencode", docs: "none", opencodeConfig: "v2", rootPath: getTmpDir() });

      expect(installAgentPlaybook).not.toHaveBeenCalled();
      expect(readJson("opencode.json").instructions).toEqual([".opencode/rules.md"]);
    });

    test("--no-agent-playbook does not wire one that is already there", async () => {
      const dir = path.join(getTmpDir(), ".opencode");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "rules.md"), "rules");
      fs.writeFileSync(path.join(dir, "playbook.json"), JSON.stringify({ instructions: [".opencode/rules.md"] }));

      await init({ tool: "opencode", docs: "none", agentPlaybook: false, opencodeConfig: "v2", rootPath: getTmpDir() });

      expect(readJson("opencode.json").instructions).toBeUndefined();
    });

    // Only Codex reads the project-root AGENTS.md alone; for anything else it is clutter.
    test("a manifest's agentsFile is not copied for a tool that does not read it", async () => {
      installAgentPlaybook.mockImplementation(async ({ rootPath }) => {
        fs.mkdirSync(path.join(rootPath, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(rootPath, ".claude", "AGENTS.md"), "PLAYBOOK");
        return { status: "installed", files: 34, manifest: { agentsFile: ".claude/AGENTS.md" } };
      });

      await init({ tool: "claude", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(fs.existsSync(path.join(getTmpDir(), "AGENTS.md"))).toBe(false);
    });

    // Filled by a concurrent checkout during the download: the same state as a directory that was
    // there from the start, reported once, and never as a success.
    test("a directory that appears during the download is reported once, not as a success", async () => {
      installAgentPlaybook.mockResolvedValue({ status: "exists" });

      await init({ tool: "claude", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      const said = (fn) => vi.mocked(fn).mock.calls.map(([message]) => message).filter((m) => /\.claude\//.test(m));
      expect(said(logger.Success)).toEqual([]);
      expect(said(logger.Info).filter((m) => /already has a \.claude\/ directory/.test(m))).toHaveLength(1);
    });

    // The servers are registered by the time the kit is offered, so a failure here is a
    // warning. Failing the command would make a convenience step able to break the real one.
    test("a failed install warns but leaves the servers registered", async () => {
      installAgentPlaybook.mockRejectedValue(new Error("Download failed with HTTP 503"));

      await init({ tool: "claude", docs: "none", agentPlaybook: true, rootPath: getTmpDir() });

      expect(vi.mocked(logger.Warn).mock.calls).toEqual([[expect.stringMatching(/Could not install.*503/s)]]);
      expect(Object.keys(readJson(".mcp.json").mcpServers)).toEqual([NAME, "platformos-supervisor"]);
    });
  });

  describe('a run that keeps going', () => {
    // Before the fix, the refusal exited the process: no Playbook, no summary, and the summary row
    // written for exactly this case was never printed.
    test('a global file that cannot be updated does not stop the Playbook or the summary', async () => {
      const home = path.join(getTmpDir(), 'home');
      fs.mkdirSync(home, { recursive: true });
      fs.writeFileSync(path.join(home, '.claude.json'), '{ not valid json');

      await init({ tool: 'claude', docs: 'global', agentPlaybook: true, rootPath: getTmpDir(), homePath: home });

      expect(installAgentPlaybook).toHaveBeenCalled();
      expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/Setup summary:[\s\S]*\(not written/));
      expect(process.exitCode).toBe(1);
    });

    // `other` registers nothing; its servers are printed for pasting.
    test('a failed portable install does not claim the servers were registered', async () => {
      installAgentPlaybook.mockRejectedValue(new Error('Download failed with HTTP 503'));

      await init({ tool: 'other', agentPlaybook: true, rootPath: getTmpDir() });

      const [[warning]] = vi.mocked(logger.Warn).mock.calls;
      expect(warning).toMatch(/Could not install/);
      expect(warning).not.toMatch(/registered regardless/);
    });
  });

  describe('the interactive prompts', () => {
    const homeDir = () => path.join(getTmpDir(), 'home');

    beforeEach(() => vi.stubEnv('XDG_CONFIG_HOME', undefined));
    afterEach(() => vi.unstubAllEnvs());

    test('asks for the tool, then where the documentation servers go', async () => {
      select.mockResolvedValueOnce('claude').mockResolvedValueOnce('global').mockResolvedValueOnce(false);

      await init({ rootPath: getTmpDir(), homePath: homeDir() });

      expect(select).toHaveBeenCalledTimes(3);
      expect(select.mock.calls[0][0].message).toMatch(/Which AI tool/);
      expect(select.mock.calls[0][0].choices.map(choice => choice.value)).toEqual([
        'claude', 'cursor', 'vscode', 'opencode', 'pi', 'codex', 'other'
      ]);
      expect(select.mock.calls[1][0].message).toMatch(/documentation servers/);
      // The first choice is what Enter takes, and the step is opt-out.
      expect(select.mock.calls[1][0].choices.map(choice => choice.value)).toEqual(['project', 'global', 'none']);
      expect(select.mock.calls[2][0].message).toMatch(/Agent Playbook/);
      expect(JSON.parse(fs.readFileSync(path.join(homeDir(), '.claude.json'), 'utf8')).mcpServers).toEqual({
        'platformos-liquid': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp' },
        'platformos-graphql': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp' }
      });
    });

    test('a documentation flag skips the second question', async () => {
      select.mockResolvedValueOnce('claude').mockResolvedValueOnce(false);

      await init({ docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      // The tool question is skipped by --docs; the agent-playbook question is not.
      expect(select).toHaveBeenCalledTimes(2);
      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual([NAME, 'platformos-supervisor']);
    });

    // "Other" has no configuration file, so there is nowhere for a scope to apply.
    test('choosing Other asks only about the portable Playbook, and writes no config', async () => {
      select.mockResolvedValueOnce('other').mockResolvedValueOnce(false);

      await init({ rootPath: getTmpDir(), homePath: homeDir() });

      // The tool, then the Playbook. Never where to put the documentation servers: there is no
      // file to put them in.
      expect(select).toHaveBeenCalledTimes(2);
      expect(select.mock.calls[1][0].message).toMatch(/Agent Playbook/);
      expect(fs.readdirSync(getTmpDir())).toEqual([]);
    });
  });
});

const LIQUID = 'platformos-liquid';
const GRAPHQL = 'platformos-graphql';
const LIQUID_URL = 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp';
const GRAPHQL_URL = 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp';
const homeDir = () => path.join(getTmpDir(), 'home');
const readHome = (...segments) => JSON.parse(fs.readFileSync(path.join(homeDir(), ...segments), 'utf8'));

describe('pi', () => {
  // piAgentDir() reads this at call time, so a value on the developer's machine would send the
  // global write outside the temporary home this suite redirects to.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PI_CODING_AGENT_DIR', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  test('writes .pi/mcp.json with command and args, and no type key', async () => {
    await init({ tool: 'pi', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

    expect(readJson('.pi', 'mcp.json').mcpServers).toEqual({
      [NAME]: { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] },
      'platformos-supervisor': { command: 'pos-cli-supervisor', args: [] },
      [LIQUID]: { url: LIQUID_URL },
      [GRAPHQL]: { url: GRAPHQL_URL }
    });
  });

  test('the global file is ~/.pi/agent/mcp.json', async () => {
    await init({ tool: 'pi', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

    expect(readHome('.pi', 'agent', 'mcp.json').mcpServers).toEqual({
      [LIQUID]: { url: LIQUID_URL },
      [GRAPHQL]: { url: GRAPHQL_URL }
    });
  });

  test('PI_CODING_AGENT_DIR moves the global file', async () => {
    vi.stubEnv('PI_CODING_AGENT_DIR', path.join(getTmpDir(), 'pidir'));

    await init({ tool: 'pi', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

    expect(fs.existsSync(path.join(getTmpDir(), 'pidir', 'mcp.json'))).toBe(true);
  });

  // `.pi/mcp.json` is as inert as the Playbook in an untrusted project.
  test('the trust gate is reported without the Playbook too', async () => {
    await init({ tool: 'pi', docs: 'none', agentPlaybook: false, rootPath: getTmpDir() });

    expect(installAgentPlaybook).not.toHaveBeenCalled();
    expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/^Project trust: pi ignores everything in \.pi\//));
  });

  // A first run without the Playbook leaves `.pi/` holding only pos-cli's own file. That is not
  // the user's directory, so a second run with the Playbook installs it.
  test('a .pi/ holding only mcp.json does not stop a later Playbook install', async () => {
    installAgentPlaybook.mockResolvedValue({ status: 'installed', files: 26, manifest: null });
    await init({ tool: 'pi', docs: 'none', agentPlaybook: false, rootPath: getTmpDir() });

    await init({ tool: 'pi', docs: 'none', agentPlaybook: true, rootPath: getTmpDir() });

    expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });
    expect(logger.Info).not.toHaveBeenCalledWith(expect.stringMatching(/already has a \.pi\/ directory/));
  });

  test('the trust gate is reported after installing the Playbook', async () => {
    installAgentPlaybook.mockResolvedValue({ status: 'installed', files: 26, manifest: null });

    await init({ tool: 'pi', docs: 'none', agentPlaybook: true, rootPath: getTmpDir() });

    expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });
    expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/ignores everything in \.pi\/ until the project is trusted/));
  });

  // Regression: `.pi/mcp.json` lives INSIDE `.pi/`, so registering the servers first creates that
  // directory and the Playbook — which never touches an existing one — declines on every fresh
  // project while reporting success. Both halves are asserted, because the bug looked like a pass.
  test('the Playbook installs even though the MCP config lives inside its directory', async () => {
    installAgentPlaybook.mockResolvedValue({ status: 'installed', files: 26, manifest: null });

    await init({ tool: 'pi', docs: 'none', agentPlaybook: true, rootPath: getTmpDir() });

    expect(installAgentPlaybook).toHaveBeenCalledWith({ rootPath: getTmpDir(), playbook: PLAYBOOKS.pi, keep: ['mcp.json'] });
    expect(logger.Info).not.toHaveBeenCalledWith(expect.stringMatching(/already has a \.pi\/ directory/));
    expect(readJson('.pi', 'mcp.json').mcpServers[NAME]).toBeDefined();
  });
});

describe('Codex', () => {
  const readToml = (...parts) => fs.readFileSync(path.join(getTmpDir(), ...parts), 'utf8');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CODEX_HOME', path.join(getTmpDir(), 'codexhome'));
  });
  afterEach(() => vi.unstubAllEnvs());

  test('writes TOML tables, not JSON', async () => {
    await init({ tool: 'codex', docs: 'project', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml).toContain('[mcp_servers.platformos-cli]');
    expect(toml).toContain('command = "pos-cli-mcp"');
    expect(toml).toContain('args = ["--profile", "dev", "--no-http"]');
    expect(toml).toContain('[mcp_servers.platformos-liquid]');
    expect(toml).toContain(`url = "${LIQUID_URL}"`);
    // Measured against codex 0.166.0: the transport is chosen by command/url, there is no type key.
    expect(toml).not.toContain('type =');
  });

  test('an existing entry is left alone and the file is not reparsed', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    const mine = '# my own notes\n[mcp_servers.platformos-cli]\ncommand = "my-wrapper"\n';
    fs.writeFileSync(path.join(dir, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml).toContain('# my own notes');
    expect(toml).toContain('command = "my-wrapper"');
    expect(toml).toContain('[mcp_servers.platformos-supervisor]');
    expect(toml.match(/\[mcp_servers\.platformos-cli\]/g)).toHaveLength(1);
  });

  test('a sub-table is not mistaken for the server table', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.toml'), '[mcp_servers.platformos-cli.env]\nFOO = "bar"\n');

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('.codex', 'config.toml')).toContain('[mcp_servers.platformos-cli]');
  });

  // One entry the file already defines with its own header, sharing no key with ours: appending a
  // second header for it is invalid TOML. That entry is kept; the rest are still added.
  test('an entry with its own table and none of our keys is kept, and the others are added', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    const mine = '[mcp_servers.platformos-supervisor]\nstartup_timeout_sec = 30\n';
    fs.writeFileSync(path.join(dir, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const parsed = parseToml(readToml('.codex', 'config.toml'));
    expect(parsed.mcp_servers['platformos-supervisor']).toEqual({ startup_timeout_sec: 30 });
    expect(parsed.mcp_servers['platformos-cli']).toEqual({ command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] });
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/Kept your own "platformos-supervisor"/));
    expect(logger.Warn).not.toHaveBeenCalledWith(expect.stringMatching(/inline table/));
  });

  test('--codex-trust writes the trust block into the global config', async () => {
    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    const global = readToml('codexhome', 'config.toml');
    expect(global).toContain(`[projects.${JSON.stringify(getTmpDir())}]`);
    expect(global).toContain('trust_level = "trusted"');
  });

  test('declining prints the block and writes nothing global', async () => {
    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    expect(fs.existsSync(path.join(getTmpDir(), 'codexhome', 'config.toml'))).toBe(false);
    // Raw, so nothing frames or rewrites it: the key is the absolute path, exactly.
    expect(logger.Log).toHaveBeenCalledWith(
      `[projects.${JSON.stringify(getTmpDir())}]\ntrust_level = "trusted"`
    );
  });

  test('a project Codex was told not to trust is switched to trusted, in place', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      path.join(home, 'config.toml'),
      `# mine\n[projects.${JSON.stringify(getTmpDir())}]\ntrust_level = "untrusted"\n`
    );

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml')).toBe(
      `# mine\n[projects.${JSON.stringify(getTmpDir())}]\ntrust_level = "trusted"\n`
    );
  });

  test('a trust table with no trust_level gains the line, and no second table', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'config.toml'), `[projects.${JSON.stringify(getTmpDir())}]\n`);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    const global = readToml('codexhome', 'config.toml');
    expect(global.match(/\[projects\./g)).toHaveLength(1);
    expect(global).toContain('trust_level = "trusted"');
  });

  test('a CRLF config is switched to trusted, and keeps its line endings', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    const key = `[projects.${JSON.stringify(getTmpDir())}]`;
    fs.writeFileSync(path.join(home, 'config.toml'), `# mine\r\n${key}\r\ntrust_level = "untrusted"\r\n`);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml')).toBe(`# mine\r\n${key}\r\ntrust_level = "trusted"\r\n`);
  });

  test('a CRLF trust table with no trust_level gains a CRLF line', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    const key = `[projects.${JSON.stringify(getTmpDir())}]`;
    fs.writeFileSync(path.join(home, 'config.toml'), `${key}\r\n`);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml')).toBe(`${key}\r\ntrust_level = "trusted"\r\n`);
  });

  // Codex wrote the key; on Windows a path differing only in case is the same project, and a second
  // table for it would be a duplicate key.
  test('on Windows an entry spelled in another case is the one edited', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    const theirs = `[projects.${JSON.stringify(getTmpDir().toUpperCase())}]\ntrust_level = "untrusted"\n`;
    fs.writeFileSync(path.join(home, 'config.toml'), theirs);
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }

    const global = readToml('codexhome', 'config.toml');
    expect(global.match(/\[projects\./g)).toHaveLength(1);
    expect(global).toContain('trust_level = "trusted"');
  });

  test('an inline trust entry is not edited, and the block is shown instead', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    const mine = `[projects]\n${JSON.stringify(getTmpDir())} = { trust_level = "untrusted" }\n`;
    fs.writeFileSync(path.join(home, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml')).toBe(mine);
    expect(logger.Log).toHaveBeenCalledWith(expect.stringMatching(/trust_level = "trusted"/));
  });

  // Every spelling below already defines the server; appending `[mcp_servers.platformos-cli]`
  // after any of them is a duplicate key, and Codex refuses the whole file.
  test.each([
    ['a quoted key', '[mcp_servers."platformos-cli"]\ncommand = "mine"\n'],
    ['dotted keys', '[mcp_servers]\nplatformos-cli.command = "mine"\n'],
    ['an inline table under a header whose comment holds a ]', '[mcp_servers] # see [docs]\nplatformos-cli = { command = "mine" }\n'],
    ['an inline table', '[mcp_servers]\nplatformos-cli = { command = "mine" }\n']
  ])('an entry written as %s is recognised and left alone', async (_label, mine) => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml).not.toContain('[mcp_servers.platformos-cli]');
    expect(toml).toContain('[mcp_servers.platformos-supervisor]');
  });

  test('an inline mcp_servers table is never appended to', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    const mine = 'mcp_servers = { other = { command = "x" } }\n';
    fs.writeFileSync(path.join(dir, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('.codex', 'config.toml')).toBe(mine);
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/inline table/));
  });

  // The manifest arrives over the network; `instructions` means something to opencode only.
  test('a manifest with instructions writes nothing into the TOML config', async () => {
    installAgentPlaybook.mockResolvedValue({
      status: 'installed',
      files: 24,
      manifest: { instructions: ['.codex/rules.md'] }
    });

    await init({ tool: 'codex', docs: 'none', codexTrust: false, agentPlaybook: true, rootPath: getTmpDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml).not.toContain('instructions');
    expect(toml.startsWith('[mcp_servers.platformos-cli]')).toBe(true);
  });

  describe.skipIf(!supportsPosixPermissions)('the global file keeps what it was', () => {
    test('an owner-only global config stays owner-only', async () => {
      const home = path.join(getTmpDir(), 'codexhome');
      fs.mkdirSync(home, { recursive: true });
      const global = path.join(home, 'config.toml');
      fs.writeFileSync(global, '[mcp_servers.x]\nenv = { KEY = "secret" }\n', { mode: 0o600 });
      fs.chmodSync(global, 0o600);

      await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

      expect(readToml('codexhome', 'config.toml')).toContain('trust_level = "trusted"');
      expect(permissionsOf(global)).toBe(0o600);
    });

    test('a symlinked global config is written through, and stays a link', async () => {
      const dotfiles = path.join(getTmpDir(), 'dotfiles');
      fs.mkdirSync(dotfiles, { recursive: true });
      fs.writeFileSync(path.join(dotfiles, 'codex.toml'), '# mine\n');
      const home = path.join(getTmpDir(), 'codexhome');
      fs.mkdirSync(home, { recursive: true });
      fs.symlinkSync(path.join(dotfiles, 'codex.toml'), path.join(home, 'config.toml'));

      await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.lstatSync(path.join(home, 'config.toml')).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(path.join(dotfiles, 'codex.toml'), 'utf8')).toContain('trust_level = "trusted"');
    });
  });

  /** Marks the project trusted in the global config, as a previous run would have. */
  const alreadyTrusted = () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      path.join(home, 'config.toml'),
      `[projects.${JSON.stringify(getTmpDir())}]\ntrust_level = "trusted"\n`
    );
  };

  // `codexTrust: true` is what makes this bite: without the already-trusted check the block would
  // be appended a second time, and Codex would carry two tables for one project.
  test('an already-trusted project is not written again, even when asked for', async () => {
    alreadyTrusted();

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml').match(/trust_level/g)).toHaveLength(1);
  });

  test('an already-trusted project is not asked about', async () => {
    alreadyTrusted();
    // tool, then documentation scope — and no third question.
    select.mockResolvedValueOnce('codex').mockResolvedValueOnce('none');

    await init({ rootPath: getTmpDir(), homePath: homeDir(), agentPlaybook: false });

    expect(select).toHaveBeenCalledTimes(2);
  });

  test('the Playbook AGENTS.md is written to the project root when there is none', async () => {
    installAgentPlaybook.mockImplementation(async ({ rootPath }) => {
      fs.mkdirSync(path.join(rootPath, '.codex'), { recursive: true });
      fs.writeFileSync(path.join(rootPath, '.codex', 'AGENTS.md'), 'PLAYBOOK INSTRUCTIONS');
      return { status: 'installed', files: 24, manifest: { agentsFile: '.codex/AGENTS.md' } };
    });

    await init({ tool: 'codex', docs: 'none', codexTrust: false, agentPlaybook: true, rootPath: getTmpDir() });

    expect(fs.readFileSync(path.join(getTmpDir(), 'AGENTS.md'), 'utf8')).toBe('PLAYBOOK INSTRUCTIONS');
  });

  test('a Playbook from an earlier run gets its AGENTS.md, and a second run says nothing about it', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'PLAYBOOK INSTRUCTIONS');
    fs.writeFileSync(path.join(dir, 'playbook.json'), JSON.stringify({ agentsFile: '.codex/AGENTS.md' }));

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });
    expect(fs.readFileSync(path.join(getTmpDir(), 'AGENTS.md'), 'utf8')).toBe('PLAYBOOK INSTRUCTIONS');

    vi.clearAllMocks();
    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });
    expect(logger.Info).not.toHaveBeenCalledWith(expect.stringMatching(/AGENTS\.md/));
  });

  // The trust question is the one asked after files are written; a Ctrl-C there must not leave
  // the Playbook half wired.
  test('the Playbook is wired before the trust question is asked', async () => {
    installAgentPlaybook.mockImplementation(async ({ rootPath }) => {
      fs.mkdirSync(path.join(rootPath, '.codex'), { recursive: true });
      fs.writeFileSync(path.join(rootPath, '.codex', 'AGENTS.md'), 'PLAYBOOK INSTRUCTIONS');
      return { status: 'installed', files: 24, manifest: { agentsFile: '.codex/AGENTS.md' } };
    });
    let wiredWhenAsked;
    select
      .mockResolvedValueOnce('codex')
      .mockResolvedValueOnce('none')
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(async () => {
        wiredWhenAsked = fs.existsSync(path.join(getTmpDir(), 'AGENTS.md'));
        return false;
      });

    await init({ rootPath: getTmpDir(), homePath: homeDir() });

    expect(select).toHaveBeenCalledTimes(4);
    expect(wiredWhenAsked).toBe(true);
  });

  test('an existing AGENTS.md is never overwritten', async () => {
    fs.writeFileSync(path.join(getTmpDir(), 'AGENTS.md'), 'MINE');
    installAgentPlaybook.mockImplementation(async ({ rootPath }) => {
      fs.mkdirSync(path.join(rootPath, '.codex'), { recursive: true });
      fs.writeFileSync(path.join(rootPath, '.codex', 'AGENTS.md'), 'PLAYBOOK INSTRUCTIONS');
      return { status: 'installed', files: 24, manifest: { agentsFile: '.codex/AGENTS.md' } };
    });

    await init({ tool: 'codex', docs: 'none', codexTrust: false, agentPlaybook: true, rootPath: getTmpDir() });

    expect(fs.readFileSync(path.join(getTmpDir(), 'AGENTS.md'), 'utf8')).toBe('MINE');
    expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/Kept your existing AGENTS\.md/));
  });

  // A line inside a multi-line value can look like a header. A hand-written reader took it for one,
  // missed the real entry after it, and appended a duplicate that made Codex refuse the file.
  test.each([
    ['a multi-line array', '[mcp_servers]\nmatrix = [\n  ["a"]\n]\nplatformos-cli = { command = "mine" }\n'],
    ['a multi-line string', 'note = """\n[x]\n"""\n[mcp_servers]\nplatformos-cli = { command = "mine" }\n']
  ])('an entry after %s is still recognised, and the file stays valid', async (_label, mine) => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml.startsWith(mine)).toBe(true);
    expect(toml).not.toContain('[mcp_servers.platformos-cli]');
    expect(parseToml(toml).mcp_servers['platformos-cli']).toEqual({ command: 'mine' });
  });

  test('a config that is not valid TOML is refused and left as it was', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.toml'), 'this is = = not toml\n');

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    expect(readToml('.codex', 'config.toml')).toBe('this is = = not toml\n');
    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid TOML/), { exit: false, notify: false });
    expect(process.exitCode).toBe(1);
  });

  test('servers appended to a CRLF config are written with CRLF', async () => {
    const dir = path.join(getTmpDir(), '.codex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.toml'), 'model = "x"\r\n');

    await init({ tool: 'codex', docs: 'none', codexTrust: false, rootPath: getTmpDir(), homePath: homeDir() });

    const toml = readToml('.codex', 'config.toml');
    expect(toml).toContain('[mcp_servers.platformos-cli]\r\n');
    expect(toml.replace(/\r\n/g, '')).not.toContain('\n');
  });

  // `#` is legal inside a quoted key. Missing this entry appended a second definition of the same
  // project, which made the user's GLOBAL Codex config unloadable.
  test('a project already listed under a quoted dotted key holding # is not defined twice', async () => {
    const root = path.join(getTmpDir(), 'C#', 'proj');
    fs.mkdirSync(root, { recursive: true });
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    const mine = `[projects]\n${JSON.stringify(root)}.trust_level = "untrusted"\n`;
    fs.writeFileSync(path.join(home, 'config.toml'), mine);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: root, homePath: homeDir() });

    expect(readToml('codexhome', 'config.toml')).toBe(mine);
    expect(logger.Log).toHaveBeenCalledWith(expect.stringMatching(/trust_level = "trusted"/));
  });

  test('a global config that cannot be read is reported, not a crash', async () => {
    fs.mkdirSync(path.join(getTmpDir(), 'codexhome', 'config.toml'), { recursive: true });

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    expect(logger.Warn).toHaveBeenCalledWith(expect.stringMatching(/could not read it/));
    expect(logger.Log).toHaveBeenCalledWith(expect.stringMatching(/trust_level = "trusted"/));
    expect(readToml('.codex', 'config.toml')).toContain('[mcp_servers.platformos-cli]');
  });

  test('a project defined only through a sub-table gains its own table', async () => {
    const home = path.join(getTmpDir(), 'codexhome');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'config.toml'), `[projects.${JSON.stringify(getTmpDir())}.extra]\nx = 1\n`);

    await init({ tool: 'codex', docs: 'none', codexTrust: true, rootPath: getTmpDir(), homePath: homeDir() });

    const parsed = parseToml(readToml('codexhome', 'config.toml'));
    expect(parsed.projects[getTmpDir()]).toEqual({ extra: { x: 1 }, trust_level: 'trusted' });
  });
});
