import { vi, describe, test, expect } from 'vitest';
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

const configPath = (...segments) => path.join(getTmpDir(), ...segments);
const readJson = (...segments) => JSON.parse(fs.readFileSync(configPath(...segments), 'utf8'));

describe('ai init', () => {
  test('claude - creates .mcp.json with both servers', async () => {
    await init({ tool: 'claude', rootPath: getTmpDir() });

    const config = readJson('.mcp.json');
    expect(config.mcpServers.platformos.command).toEqual('pos-cli-mcp');
    expect(config.mcpServers['platformos-supervisor'].command).toEqual('pos-cli-supervisor');
    expect(logger.Success).toHaveBeenCalledWith(expect.stringMatching(/Registered MCP servers/));
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

  test('claude - overwrites our entries when they differ, reports update', async () => {
    fs.writeFileSync(
      configPath('.mcp.json'),
      JSON.stringify({ mcpServers: { platformos: { command: 'outdated-command' } } })
    );

    await init({ tool: 'claude', rootPath: getTmpDir() });

    const config = readJson('.mcp.json');
    expect(config.mcpServers.platformos.command).toEqual('pos-cli-mcp');
    expect(logger.Info).toHaveBeenCalledWith(expect.stringMatching(/Updated existing entries.*platformos/));
  });

  test('cursor - creates .cursor/mcp.json', async () => {
    await init({ tool: 'cursor', rootPath: getTmpDir() });

    const config = readJson('.cursor', 'mcp.json');
    expect(config.mcpServers.platformos.command).toEqual('pos-cli-mcp');
    expect(config.mcpServers['platformos-supervisor'].command).toEqual('pos-cli-supervisor');
  });

  test('vscode - creates .vscode/mcp.json with servers key and stdio type', async () => {
    await init({ tool: 'vscode', rootPath: getTmpDir() });

    const config = readJson('.vscode', 'mcp.json');
    expect(config.mcpServers).toBeUndefined();
    expect(config.servers.platformos).toEqual({ type: 'stdio', command: 'pos-cli-mcp' });
    expect(config.servers['platformos-supervisor']).toEqual({ type: 'stdio', command: 'pos-cli-supervisor' });
  });

  test('other - writes no files and prints the snippet', async () => {
    await init({ tool: 'other', rootPath: getTmpDir() });

    expect(fs.readdirSync(getTmpDir())).toEqual([]);
    expect(logger.Log).toHaveBeenCalledWith(expect.stringContaining('pos-cli-supervisor'));
  });

  test('claude - aborts on invalid JSON without touching the file', async () => {
    fs.writeFileSync(configPath('.mcp.json'), '{ not valid json');

    await init({ tool: 'claude', rootPath: getTmpDir() });

    expect(logger.Error).toHaveBeenCalledWith(expect.stringMatching(/not valid JSON/));
    expect(fs.readFileSync(configPath('.mcp.json'), 'utf8')).toEqual('{ not valid json');
  });
});
