import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import cli from '#test/utils/exec';

vi.setConfig({ testTimeout: 60000 });

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-ai-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const run = (options = '', env = {}) =>
  cli(`ai init ${options}`, { cwd: tmpDir, env: { ...process.env, ...env } });

describe('pos-cli ai init', () => {
  const LOCAL_SERVERS = {
    'platformos-cli': { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] },
    'platformos-supervisor': { command: 'pos-cli-supervisor' }
  };

  const DOCS_SERVERS = {
    'platformos-liquid': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/liquid-mcp' },
    'platformos-graphql': { type: 'http', url: 'https://pos-mcp-tools.ps-01-platformos.com/graphql-mcp' }
  };

  const readConfig = (...segments) => JSON.parse(fs.readFileSync(path.join(tmpDir, ...segments), 'utf8'));

  // Naming a tool takes the defaults without asking, and the documentation servers default to yes.
  test('--tool claude writes the local servers and the documentation servers', async () => {
    const { stdout, code } = await run('--tool claude');

    expect(code).toEqual(0);
    expect(stdout).toMatch('Registered MCP servers');

    expect(readConfig('.mcp.json').mcpServers).toEqual({ ...LOCAL_SERVERS, ...DOCS_SERVERS });
  });

  test('--tool claude --no-docs writes only the local servers', async () => {
    const { code } = await run('--tool claude --no-docs');

    expect(code).toEqual(0);
    expect(readConfig('.mcp.json').mcpServers).toEqual(LOCAL_SERVERS);
  });

  // opencode 2 keeps servers under `mcp.servers`; the older `mcp.<name>` shape is deprecated in
  // its published schema. Both are still written on request — see the --opencode-config test.
  test('--tool opencode writes opencode.json with servers under mcp.servers', async () => {
    const { code } = await run('--tool opencode --no-docs');

    expect(code).toEqual(0);
    const config = readConfig('opencode.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.mcp).toEqual({
      servers: {
        'platformos-cli': { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'] },
        'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'] }
      }
    });
  });

  test('--tool opencode --opencode-config v1 writes the legacy shape', async () => {
    const { code } = await run('--tool opencode --no-docs --opencode-config v1');

    expect(code).toEqual(0);
    const config = readConfig('opencode.json');
    expect(config.mcp.servers).toBeUndefined();
    expect(config.mcp).toEqual({
      'platformos-cli': { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
      'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true }
    });
  });

  test('--tool pi writes .pi/mcp.json', async () => {
    const { code } = await run('--tool pi --no-docs', { PI_CODING_AGENT_DIR: path.join(tmpDir, 'piagent') });

    expect(code).toEqual(0);
    expect(readConfig('.pi', 'mcp.json').mcpServers).toEqual({
      'platformos-cli': { command: 'pos-cli-mcp', args: ['--profile', 'dev', '--no-http'] },
      'platformos-supervisor': { command: 'pos-cli-supervisor', args: [] }
    });
  });

  // Codex is the one tool whose configuration is TOML, so this asserts the text rather than JSON.
  // CODEX_HOME is redirected into the temp dir: --no-codex-trust means nothing global is written,
  // and the redirect makes that true by construction rather than by trusting the flag.
  test('--tool codex writes .codex/config.toml as TOML', async () => {
    const codexHome = path.join(tmpDir, 'codexhome');
    const { code } = await run('--tool codex --no-docs --no-codex-trust', { CODEX_HOME: codexHome });

    expect(code).toEqual(0);
    const toml = fs.readFileSync(path.join(tmpDir, '.codex', 'config.toml'), 'utf8');
    expect(toml).toContain('[mcp_servers.platformos-cli]');
    expect(toml).toContain('command = "pos-cli-mcp"');
    expect(toml).toContain('args = ["--profile", "dev", "--no-http"]');
    expect(toml).toContain('[mcp_servers.platformos-supervisor]');
    // Measured against codex-cli 0.166.0: the transport is chosen by command/url, there is no type key.
    expect(toml).not.toContain('type =');
    expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(false);
  });

  test('--tool codex --codex-trust marks the project trusted in the global config', async () => {
    const codexHome = path.join(tmpDir, 'codexhome');
    const { code } = await run('--tool codex --no-docs --codex-trust', { CODEX_HOME: codexHome });

    expect(code).toEqual(0);
    const global = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    expect(global).toContain(`[projects.${JSON.stringify(fs.realpathSync(tmpDir))}]`);
    expect(global).toContain('trust_level = "trusted"');
  });

  test('--tool other prints the snippet and writes nothing', async () => {
    const { stdout, code } = await run('--tool other');

    expect(code).toEqual(0);
    expect(stdout).toMatch('pos-cli-supervisor');
    expect(fs.existsSync(path.join(tmpDir, '.mcp.json'))).toBeFalsy();
  });

  test('--tool with unknown value fails with allowed choices', async () => {
    const { stderr, code } = await run('--tool bogus');

    expect(code).not.toEqual(0);
    expect(stderr).toMatch(/allowed choices/i);
    expect(stderr).toMatch('claude');
  });

  test('help lists the ai command and its init subcommand', async () => {
    const aiHelp = await cli('ai --help');
    expect(aiHelp.stdout).toMatch('Usage: pos-cli ai');
    expect(aiHelp.stdout).toMatch('init');
    expect(aiHelp.stdout).toMatch('register platformOS MCP servers');

    const rootHelp = await cli('--help');
    expect(rootHelp.stdout).toMatch('configure AI tools');
  });
});
