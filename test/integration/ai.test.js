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

const run = (options = '') => cli(`ai init ${options}`, { cwd: tmpDir });

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

  test('--tool opencode writes opencode.json with servers under the mcp key', async () => {
    const { code } = await run('--tool opencode --no-docs');

    expect(code).toEqual(0);
    const config = readConfig('opencode.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.mcp).toEqual({
      'platformos-cli': { type: 'local', command: ['pos-cli-mcp', '--profile', 'dev', '--no-http'], enabled: true },
      'platformos-supervisor': { type: 'local', command: ['pos-cli-supervisor'], enabled: true }
    });
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
