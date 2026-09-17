import { vi, describe, test, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import logger from '#lib/logger.js';
import { init } from '#lib/ai.js';

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
    expect(config.mcpServers).toEqual({ platformos: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Success).toHaveBeenCalledWith(
      'Registered MCP servers (platformos, platformos-supervisor) for Claude Code in .mcp.json'
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
    expect(config.mcpServers.platformos.command).toEqual('pos-cli-mcp');
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
    writeJson({ mcpServers: { platformos: earlier, 'platformos-supervisor': SUPERVISOR } }, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ platformos: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Info).toHaveBeenCalledWith('Updated existing entries in .mcp.json: platformos');
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos) for Claude Code in .mcp.json');
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  test('vscode - upgrades the earlier entry whatever order its keys are in', async () => {
    writeJson({ servers: { platformos: { args: ['--profile', 'dev'], command: 'pos-cli-mcp', type: 'stdio' } } }, '.vscode', 'mcp.json');

    await init({ tool: 'vscode', rootPath: getTmpDir() });

    expect(readJson('.vscode', 'mcp.json').servers.platformos).toEqual({ type: 'stdio', ...PLATFORMOS });
    expect(logger.Info).toHaveBeenCalledWith('Updated existing entries in .vscode/mcp.json: platformos');
  });

  // Choosing a profile, adding environment variables or pointing at a local build are all
  // reasons someone edits the entry; re-running init must not undo that.
  test.each([
    ['another profile', { command: 'pos-cli-mcp', args: ['--profile', 'full'] }],
    ['the HTTP listener kept on purpose', { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--exclude-tools', 'deploy-wait'] }],
    ['extra settings', { ...PLATFORMOS, env: { MCP_TOOLS_CONFIG: 'tools.json' } }],
    ['a different command', { command: 'outdated-command' }],
    ['the same args in another order', { command: 'pos-cli-mcp', args: ['dev', '--profile'] }]
  ])('claude - keeps an entry customised with %s, untouched, and says so', async (_label, customised) => {
    const original = JSON.stringify({ mcpServers: { platformos: customised, 'platformos-supervisor': SUPERVISOR } }, null, 2);
    writeJson(original, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(original);
    expect(logger.Warn).toHaveBeenCalledWith(
      `Kept your customised "platformos" entry in .mcp.json. pos-cli ai init would write ${JSON.stringify(PLATFORMOS)}; ` +
        'merge that in by hand if you want it.'
    );
    expect(logger.Success).not.toHaveBeenCalled();
    expect(logger.Info).not.toHaveBeenCalled();
  });

  test('claude - adds a missing server next to a customised one, without touching the customised one', async () => {
    const customised = { command: 'pos-cli-mcp', args: ['--profile', 'full'] };
    writeJson({ mcpServers: { platformos: customised } }, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers).toEqual({ platformos: customised, 'platformos-supervisor': SUPERVISOR });
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos" entry'));
    expect(logger.Success).toHaveBeenCalledWith('Registered MCP servers (platformos-supervisor) for Claude Code in .mcp.json');
  });

  test('claude - keeps a customised supervisor entry too', async () => {
    const customised = { command: 'pos-cli-supervisor', args: ['--project', 'app'] };
    writeJson({ mcpServers: { platformos: PLATFORMOS, 'platformos-supervisor': customised } }, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(readJson('.mcp.json').mcpServers['platformos-supervisor']).toEqual(customised);
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Kept your customised "platformos-supervisor" entry'));
  });

  test('claude - the current entry with its keys reordered is already configured', async () => {
    const original = JSON.stringify({ mcpServers: { platformos: { args: ['--profile', 'dev', '--no-http'], command: 'pos-cli-mcp' }, 'platformos-supervisor': SUPERVISOR } });
    writeJson(original, '.mcp.json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual(original);
    expect(logger.Success).toHaveBeenCalledWith('Claude Code is already configured in .mcp.json - nothing to do.');
    expect(logger.Warn).not.toHaveBeenCalled();
  });

  test('cursor - creates .cursor/mcp.json', async () => {
    await init({ tool: 'cursor', rootPath: getTmpDir() });

    const config = readJson('.cursor', 'mcp.json');
    expect(config.mcpServers).toEqual({ platformos: PLATFORMOS, 'platformos-supervisor': SUPERVISOR });
  });

  test('vscode - creates .vscode/mcp.json with servers key and stdio type', async () => {
    await init({ tool: 'vscode', rootPath: getTmpDir() });

    const config = readJson('.vscode', 'mcp.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.servers.platformos).toEqual({ type: 'stdio', command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] });
    expect(config.servers['platformos-supervisor']).toEqual({ type: 'stdio', command: 'pos-cli-supervisor' });
  });

  test('other - writes no files and prints the snippet', async () => {
    await init({ tool: 'other', rootPath: getTmpDir() });

    expect(fs.readdirSync(getTmpDir())).toEqual([]);
    expect(JSON.parse(vi.mocked(logger.Log).mock.calls.at(-1)[0])).toEqual({
      mcpServers: { platformos: PLATFORMOS, 'platformos-supervisor': SUPERVISOR }
    });
  });

  test('claude - aborts on invalid JSON without touching the file', async () => {
    fs.writeFileSync(configPath('.mcp.json'), '{ not valid json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/));
    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual('{ not valid json');
  });
});
