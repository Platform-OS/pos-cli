import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';

vi.setConfig({ testTimeout: 60000 });

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-ai-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const run = (options = '') => exec(`${cliPath} ai init ${options}`, { cwd: tmpDir });

describe('pos-cli ai init', () => {
  test('--tool claude creates .mcp.json with both servers', async () => {
    const { stdout, code } = await run('--tool claude');

    expect(code).toEqual(0);
    expect(stdout).toMatch('Registered MCP servers');

    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf8'));
    expect(config.mcpServers.platformos.command).toEqual('pos-cli-mcp');
    expect(config.mcpServers['platformos-supervisor'].command).toEqual('pos-cli-supervisor');
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
    const aiHelp = await exec(`${cliPath} ai --help`);
    expect(aiHelp.stdout).toMatch('Usage: pos-cli ai');
    expect(aiHelp.stdout).toMatch('init');
    expect(aiHelp.stdout).toMatch('register platformOS MCP servers');

    const rootHelp = await exec(`${cliPath} --help`);
    expect(rootHelp.stdout).toMatch('configure AI tools');
  });
});
