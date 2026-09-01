/**
 * tools.config.json decides which tools the MCP server exposes, so a config that does not
 * match tools.config.schema.json must stop the server rather than be ignored — ignoring it
 * would silently re-enable every tool the author meant to switch off.
 *
 * Each case runs in its own process because tools.js reads the config once, at import.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

let tmpDir;

const write = (name, contents) => {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, contents);
  return file;
};

// Reports what `import('./mcp-min/tools.js')` did under the given config.
const loadWithConfig = configPath => {
  const script =
    "import('./mcp-min/tools.js')" +
    ".then(m => console.log('OK:' + Object.keys(m.default).join(',')))" +
    ".catch(e => { console.log('REJECTED:' + e.message); process.exitCode = 1; })";

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, MCP_TOOLS_CONFIG: configPath },
    encoding: 'utf8'
  });

  return { stdout: result.stdout || '', status: result.status };
};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-tools-config-'));
});

afterAll(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('tools config validation', () => {
  test('refuses to start when a config field has the wrong type', () => {
    const configPath = write('wrong-type.json', JSON.stringify({ tools: { 'envs-list': { enabled: 'yes' } } }));
    const { stdout, status } = loadWithConfig(configPath);

    expect(stdout).toContain('REJECTED:');
    expect(stdout).toContain('/tools/envs-list/enabled must be boolean');
    expect(status).not.toBe(0);
  });

  test('refuses to start when the config is not an object', () => {
    const configPath = write('array.json', JSON.stringify(['envs-list']));
    const { stdout } = loadWithConfig(configPath);

    expect(stdout).toContain('REJECTED:');
  });

  // These parse as valid JSON but are not configs. Testing the parsed value for
  // truthiness would skip validation and fall through to defaults with everything on.
  test.each(['null', 'false', '0', '""'])('refuses to start on a bare %s config', literal => {
    const configPath = write(`falsy-${literal.replace(/\W/g, '_')}.json`, literal);
    const { stdout, status } = loadWithConfig(configPath);

    expect(stdout).toContain('REJECTED:');
    expect(status).not.toBe(0);
  });

  test('applies a valid config and disables the named tool', () => {
    const configPath = write('valid.json', JSON.stringify({ tools: { 'envs-list': { enabled: false } } }));
    const { stdout, status } = loadWithConfig(configPath);

    expect(status).toBe(0);
    expect(stdout).toContain('OK:');
    expect(stdout).not.toContain('envs-list');
  });

  test('falls back to defaults when the config file does not exist', () => {
    const { stdout, status } = loadWithConfig(path.join(tmpDir, 'absent.json'));

    expect(status).toBe(0);
    expect(stdout).toContain('envs-list');
  });

  test('the config shipped in the package satisfies its own schema', () => {
    const here = path.dirname(new URL(import.meta.url).pathname);
    const schema = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.schema.json'), 'utf8'));
    const config = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.json'), 'utf8'));

    // Imported here rather than at the top so this file stays runnable in isolation.
    return import('../../lib/validation/index.js').then(({ validate }) => {
      expect(validate(schema, config).errors ?? []).toEqual([]);
    });
  });
});
