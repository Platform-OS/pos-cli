import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import logger from '#lib/logger.js';
import { init, SERVERS, DOCS_SERVERS, RENAMED_FROM } from '#lib/ai.js';

const select = vi.fn();
vi.mock('@inquirer/prompts', () => ({ select: (...args) => select(...args) }));

vi.mock('#lib/logger.js', () => ({
  default: {
    Error: vi.fn(),
    Success: vi.fn(),
    Info: vi.fn(),
    Warn: vi.fn(),
    Log: vi.fn(),
    Debug: vi.fn()
  }
}));

const getTmpDir = withTmpDir();

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
  });

  test('claude - creates .mcp.json with both servers', async () => {
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

    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/));
    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual('{ not valid json');
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

    // configHome() reads this at call time, so a value on the developer's machine would send
    // the opencode global write outside the temporary home this suite redirects to.
    beforeEach(() => vi.stubEnv('XDG_CONFIG_HOME', undefined));
    afterEach(() => vi.unstubAllEnvs());

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

    // VS Code keeps its user configuration under a path that varies by platform and by build
    // (Code, Insiders, VSCodium). Guessing it would write a file nothing reads.
    test('vscode - docs global writes nothing outside the project and prints what to paste', async () => {
      await init({ tool: 'vscode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.existsSync(homeDir())).toBe(false);
      expect(Object.keys(readJson('.vscode', 'mcp.json').servers)).toEqual([NAME, 'platformos-supervisor']);
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('MCP: Open User Configuration'));
      expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
        servers: { [LIQUID]: { type: 'http', url: LIQUID_URL }, [GRAPHQL]: { type: 'http', url: GRAPHQL_URL } }
      });
    });

    test('vscode - docs project still writes them into .vscode/mcp.json', async () => {
      await init({ tool: 'vscode', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      expect(readJson('.vscode', 'mcp.json').servers[LIQUID]).toEqual({ type: 'http', url: LIQUID_URL });
    });

    test('opencode - project file uses the mcp key, a command array and type local', async () => {
      await init({ tool: 'opencode', docs: 'project', rootPath: getTmpDir(), homePath: homeDir() });

      const config = readJson('opencode.json');
      expect(config.$schema).toEqual('https://opencode.ai/config.json');
      expect(config.mcpServers).toBeUndefined();
      expect(config.mcp).toEqual({
        [NAME]: { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
        'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true },
        [LIQUID]: { type: 'remote', url: LIQUID_URL, enabled: true },
        [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL, enabled: true }
      });
    });

    test('opencode - the global file is ~/.config/opencode/opencode.json', async () => {
      await init({ tool: 'opencode', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(Object.keys(readJson('opencode.json').mcp)).toEqual([NAME, 'platformos-supervisor']);
      expect(readHome('.config', 'opencode', 'opencode.json').mcp).toEqual({
        [LIQUID]: { type: 'remote', url: LIQUID_URL, enabled: true },
        [GRAPHQL]: { type: 'remote', url: GRAPHQL_URL, enabled: true }
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
      expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/));
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
        await expect(
          init({ tool: 'claude', docs: 'none', rootPath: getTmpDir(), homePath: homeDir() })
        ).rejects.toThrow(/EXDEV/);

        expect(renameSync).toHaveBeenCalled();
        expect(fs.readdirSync(getTmpDir())).toEqual([]);
      } finally {
        renameSync.mockRestore();
      }
    });

    test('no temporary file is left beside a config pos-cli wrote', async () => {
      await init({ tool: 'claude', docs: 'global', rootPath: getTmpDir(), homePath: homeDir() });

      expect(fs.readdirSync(getTmpDir()).filter(name => name.includes('.tmp'))).toEqual([]);
      expect(fs.readdirSync(homeDir()).filter(name => name.includes('.tmp'))).toEqual([]);
    });
  });

  describe('the interactive prompts', () => {
    const homeDir = () => path.join(getTmpDir(), 'home');

    beforeEach(() => vi.stubEnv('XDG_CONFIG_HOME', undefined));
    afterEach(() => vi.unstubAllEnvs());

    test('asks for the tool, then where the documentation servers go', async () => {
      select.mockResolvedValueOnce('claude').mockResolvedValueOnce('global');

      await init({ rootPath: getTmpDir(), homePath: homeDir() });

      expect(select).toHaveBeenCalledTimes(2);
      expect(select.mock.calls[0][0].message).toMatch(/Which AI tool/);
      expect(select.mock.calls[0][0].choices.map(choice => choice.value)).toEqual([
        'claude', 'cursor', 'vscode', 'opencode', 'other'
      ]);
      expect(select.mock.calls[1][0].message).toMatch(/documentation servers/);
      // The first choice is what Enter takes, and the step is opt-out.
      expect(select.mock.calls[1][0].choices.map(choice => choice.value)).toEqual(['project', 'global', 'none']);
      expect(JSON.parse(fs.readFileSync(path.join(homeDir(), '.claude.json'), 'utf8')).mcpServers).toEqual({
        'platformos-liquid': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp' },
        'platformos-graphql': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp' }
      });
    });

    test('a documentation flag skips the second question', async () => {
      select.mockResolvedValueOnce('claude');

      await init({ docs: 'none', rootPath: getTmpDir(), homePath: homeDir() });

      expect(select).toHaveBeenCalledTimes(1);
      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual([NAME, 'platformos-supervisor']);
    });

    // "Other" has no configuration file, so there is nowhere for a scope to apply.
    test('choosing Other does not ask where to put them', async () => {
      select.mockResolvedValueOnce('other');

      await init({ rootPath: getTmpDir(), homePath: homeDir() });

      expect(select).toHaveBeenCalledTimes(1);
      expect(fs.readdirSync(getTmpDir())).toEqual([]);
    });
  });
});
