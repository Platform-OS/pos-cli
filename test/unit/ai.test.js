import { vi, describe, test, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import logger from '#lib/logger.js';
import { init, SERVERS, RENAMED_FROM, PLUGIN_DIR, PLUGIN_ID, REMINDERS_PLUGIN_ID } from '#lib/ai.js';

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
    await init({ tool: 'claude', rootPath: getTmpDir() });

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

    await init({ tool: 'claude', rootPath: getTmpDir() });

    const config = readJson('.mcp.json');
    expect(config.someOtherSetting).toEqual(true);
    expect(config.mcpServers.github).toEqual({ command: 'github-mcp', args: ['--stdio'] });
    expect(config.mcpServers[NAME].command).toEqual('pos-cli-mcp');
    expect(config.mcpServers['platformos-supervisor'].command).toEqual('pos-cli-supervisor');
  });

  test('claude - second run is idempotent and does not rewrite the file', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });
    const firstRunContent = fs.readFileSync(configPath('.mcp.json'), 'utf8');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(firstRunContent);
    expect(logger.Success).toHaveBeenLastCalledWith(expect.stringMatching(/already configured/));
  });

  // Entries earlier releases wrote: nobody chose them, so they move to the current form.
  test.each([
    ['with no arguments (6.5 and earlier)', { command: 'pos-cli-mcp' }],
    ['with the dev profile but still opening an HTTP listener', { command: 'pos-cli-mcp', args: ['--profile', 'dev'] }]
  ])('claude - upgrades an entry an earlier release wrote %s, and reports it', async (_label, earlier) => {
    writeJson({ mcpServers: { [NAME]: earlier, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Info).toHaveBeenCalledWith('Updated existing entries in .mcp.json: platformos-cli');
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos-cli) for Claude Code in .mcp.json');
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  test('vscode - upgrades the earlier entry whatever order its keys are in', async () => {
    writeJson({ servers: { [NAME]: { args: ['--profile', 'dev'], command: 'pos-cli-mcp', type: 'stdio' } } }, '.vscode', 'mcp.json');

    await init({ tool: 'vscode', rootPath: getTmpDir() });

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

    await init({ tool: 'claude', rootPath: getTmpDir() });

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

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: customised, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos-cli" entry'));
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos-supervisor) for Claude Code in .mcp.json');
  });

  test('claude - keeps a customised supervisor entry too', async () => {
    const customised = { command: 'pos-cli-supervisor', args: ['--project', 'app'] };
    writeJson({ mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': customised } }, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers['platformos-supervisor']).toEqual(customised);
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos-supervisor" entry'));
  });

  test('claude - the current entry with its keys reordered is already configured', async () => {
    const original = JSON.stringify({ mcpServers: { [NAME]: { args: ['--profile', 'dev', '--no-http'], command: 'pos-cli-mcp' }, 'platformos-supervisor': SUPERVISOR } });
    writeJson(original, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

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

      await init({ tool: 'claude', rootPath: getTmpDir() });

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

      await init({ tool: 'claude', rootPath: getTmpDir() });

      expect(Object.keys(readJson('.mcp.json').mcpServers)).toEqual(['github', NAME, 'platformos-supervisor', 'sentry']);
    });

    test('renames in VS Code too, where the entry carries a type', async () => {
      writeJson({ servers: { [OLD_NAME]: { type: 'stdio', command: 'pos-cli-mcp' } } }, '.vscode', 'mcp.json');

      await init({ tool: 'vscode', rootPath: getTmpDir() });

      expect(readJson('.vscode', 'mcp.json').servers).toEqual({
        [NAME]: { type: 'stdio', ...PLATFORMOS },
        'platformos-supervisor': { type: 'stdio', ...SUPERVISOR }
      });
    });

    // Adding platformos-cli beside a customised old entry would run their server and ours at once.
    test('leaves a customised entry under the old name alone, and adds no second one', async () => {
      const customised = { command: 'pos-cli-mcp', args: ['--profile', 'full'], env: { MCP_TOOLS_CONFIG: 'tools.json' } };
      writeJson({ mcpServers: { [OLD_NAME]: customised } }, '.mcp.json');

      await init({ tool: 'claude', rootPath: getTmpDir() });

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

      await init({ tool: 'claude', rootPath: getTmpDir() });

      expect(readJson('.mcp.json').mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
      expect(logger.Info).toHaveBeenCalledWith('Renamed entries in .mcp.json: platformos (removed; platformos-cli is the entry now)');
    });

    test('a customised old entry kept beside the new one is not removed', async () => {
      const customised = { command: 'node', args: ['./local/pos-cli-mcp.js'] };
      writeJson({ mcpServers: { [OLD_NAME]: customised, [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

      await init({ tool: 'claude', rootPath: getTmpDir() });

      expect(readJson('.mcp.json').mcpServers[OLD_NAME]).toEqual(customised);
    });

    test('a rename is written once: the next run has nothing to do', async () => {
      writeJson({ mcpServers: { [OLD_NAME]: { command: 'pos-cli-mcp' } } }, '.mcp.json');
      await init({ tool: 'claude', rootPath: getTmpDir() });
      const afterRename = fs.readFileSync(configPath('.mcp.json'), 'utf8');
      vi.clearAllMocks();

      await init({ tool: 'claude', rootPath: getTmpDir() });

      expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(afterRename);
      expect(logger.Success).toHaveBeenCalledWith('Claude Code is already configured in .mcp.json - nothing to do.');
    });

    test('the supervisor is not renamed: only the pos-cli server was', async () => {
      expect(RENAMED_FROM).toEqual({ [NAME]: OLD_NAME });
      expect(Object.keys(SERVERS)).toEqual([NAME, 'platformos-supervisor']);
    });
  });

  test('cursor - creates .cursor/mcp.json', async () => {
    await init({ tool: 'cursor', rootPath: getTmpDir() });

    const config = readJson('.cursor', 'mcp.json');
    expect(config.mcpServers).toEqual({ [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
  });

  test('vscode - creates .vscode/mcp.json with servers key and stdio type', async () => {
    await init({ tool: 'vscode', rootPath: getTmpDir() });

    const config = readJson('.vscode', 'mcp.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.servers[NAME]).toEqual({ type: 'stdio', command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] });
    expect(config.servers['platformos-supervisor']).toEqual({ type: 'stdio', command: 'pos-cli-supervisor' });
  });

  test('other - writes no files and prints the snippet', async () => {
    await init({ tool: 'other', rootPath: getTmpDir() });

    expect(fs.readdirSync(getTmpDir())).toEqual([]);
    expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
      mcpServers: { [NAME]: PLATFORMOS, 'platformos-supervisor': SUPERVISOR }
    });
  });

  test('claude - aborts on invalid JSON without touching the file', async () => {
    fs.writeFileSync(configPath('.mcp.json'), '{ not valid json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/));
    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual('{ not valid json');
  });
});

/**
 * Claude Code takes language-server configuration only from a plugin, and installing one is a real
 * install that writing a JSON file cannot stand in for — so init prints the commands instead of
 * running them, which is also what keeps it from depending on the `claude` binary being present.
 */
describe('ai init — the language server', () => {
  // An offer, not a warning: it goes through Log, which applies no colour of its own. Info is
  // chalk.bold, and a paragraph of bold text reads as something having gone wrong.
  const infoText = () => [...logger.Log.mock.calls, ...logger.Info.mock.calls]
    .map(([message]) => String(message ?? '')).join('\n');

  const enablePluginIn = (...segments) => {
    writeJson({ enabledPlugins: { [PLUGIN_ID]: true } }, ...segments);
  };

  test('claude - prints both commands, with a path that exists', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });

    const text = infoText();
    expect(text).toContain('claude plugin marketplace add');
    expect(text).toContain(`claude plugin install ${PLUGIN_ID}`);
    // The manifest has to be where the printed command points, or the paste fails.
    expect(fs.existsSync(path.join(PLUGIN_DIR, '.claude-plugin', 'marketplace.json'))).toBe(true);
    expect(text).toContain(PLUGIN_DIR);
  });

  // A pasted command naming a plugin the marketplace does not have fails at the terminal, and the
  // ids are close enough to each other that string-building one is easy to get wrong.
  test('every plugin id it prints exists in the shipped marketplace', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });

    const marketplace = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'marketplace.json'), 'utf8')
    );
    const real = new Set(marketplace.plugins.map(p => `${p.name}@${marketplace.name}`));

    const printed = [...infoText().matchAll(/claude plugin install (\S+)/g)].map(m => m[1]);
    expect(printed.length).toBeGreaterThan(0);
    for (const id of printed) {
      expect(real, `${id} is not a plugin in the shipped marketplace`).toContain(id);
    }
    expect(printed).toContain(PLUGIN_ID);
    expect(printed).toContain(REMINDERS_PLUGIN_ID);
  });

  test('the printed path is quoted, since an install path may contain spaces', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });
    expect(infoText()).toContain(`"${PLUGIN_DIR}"`);
  });

  test('says nothing when the plugin is already enabled for this project', async () => {
    enablePluginIn('.claude', 'settings.local.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(infoText()).not.toContain('claude plugin install');
    expect(logger.Success).toHaveBeenCalledWith(expect.stringMatching(/language server.*already registered/i));
  });

  test('a settings file that is not valid JSON is not a yes, and does not throw', async () => {
    writeJson('{ this is not json', '.claude', 'settings.local.json');

    await expect(init({ tool: 'claude', rootPath: getTmpDir() })).resolves.not.toThrow();
    expect(infoText()).toContain('claude plugin install');
  });

  // The plugin mechanism is Claude Code's; suggesting it to another tool would be noise.
  test.each(['cursor', 'vscode'])('%s - is not told about a Claude Code plugin', async (tool) => {
    await init({ tool, rootPath: getTmpDir() });
    expect(infoText()).not.toContain('claude plugin');
  });

  // It is bold on a terminal, and a wall of bold text reads as an error rather than an offer.
  test('is not printed through Info', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });

    const info = logger.Info.mock.calls.map(([message]) => String(message ?? '')).join('\n');
    expect(info).not.toContain('claude plugin');
  });

  // Every claim here has been wrong once: it said diagnostics arrive as files are read, and they
  // do not — the server answers when something asks it.
  test('does not claim diagnostics happen on their own', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });

    const text = infoText();
    expect(text).not.toMatch(/as files are read|automatic|automatically/i);
    expect(text).toMatch(/does not trigger them|when something asks/);
  });
});
