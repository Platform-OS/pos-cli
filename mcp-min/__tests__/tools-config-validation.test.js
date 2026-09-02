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
import { fileURLToPath } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

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
  //
  // The assertion names the schema violation deliberately: a bare `null` also crashes
  // applyConfig with a TypeError, so asserting only that startup failed would pass even
  // with the fail-closed check removed.
  test.each(['null', 'false', '0', '""'])('refuses to start on a bare %s config', literal => {
    const configPath = write(`falsy-${literal.replace(/\W/g, '_')}.json`, literal);
    const { stdout, status } = loadWithConfig(configPath);

    expect(stdout).toContain('REJECTED:');
    expect(stdout).toContain('Invalid tools config');
    expect(stdout).toContain('must be object');
    expect(stdout).not.toContain('TypeError');
    expect(status).not.toBe(0);
  });

  // The schema constrains each entry's shape but cannot enumerate tool names, so this
  // is the case it structurally cannot catch: a typo leaves the real tool enabled while
  // the config looks like it took effect.
  test('refuses to start when a config names a tool that does not exist', () => {
    const configPath = write('typo.json', JSON.stringify({ tools: { 'deploy-strt': { enabled: false } } }));
    const { stdout, status } = loadWithConfig(configPath);

    expect(stdout).toContain('no such tool: deploy-strt');
    expect(status).not.toBe(0);
  });

  test('names every unknown tool, not just the first', () => {
    const configPath = write('typos.json', JSON.stringify({
      tools: { 'deploy-strt': { enabled: false }, 'constants-lst': { enabled: false } }
    }));
    const { stdout } = loadWithConfig(configPath);

    expect(stdout).toContain('deploy-strt');
    expect(stdout).toContain('constants-lst');
  });

  // `name in registry` would accept these, because `in` walks the prototype chain — they
  // would then match nothing in applyConfig and be silently ignored.
  test.each(['toString', 'constructor', 'hasOwnProperty', 'valueOf'])(
    'refuses a config keyed by the inherited property %s',
    key => {
      const configPath = write(`proto-${key}.json`, JSON.stringify({ tools: { [key]: { enabled: false } } }));
      const { stdout, status } = loadWithConfig(configPath);

      expect(stdout).toContain(`no such tool: ${key}`);
      expect(status).not.toBe(0);
    }
  );

  test('accepts a config naming only real tools', () => {
    const configPath = write('real.json', JSON.stringify({
      tools: { 'deploy-start': { description: 'Ship it' } }
    }));
    const { stdout, status } = loadWithConfig(configPath);

    expect(status).toBe(0);
    expect(stdout).toContain('deploy-start');
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

  // CLAUDE.md requires user-facing errors to go through the logger. A module-loader
  // stack trace reaching the terminal is the failure mode this guards.
  test('reports an invalid config as a message, not a Node stack trace', () => {
    const configPath = write('for-cli.json', JSON.stringify({ tools: { 'envs-list': { enabled: 'yes' } } }));

    const result = spawnSync(process.execPath, [path.join(here, '..', '..', 'bin', 'pos-cli-mcp.js')], {
      cwd: repoRoot,
      env: { ...process.env, MCP_TOOLS_CONFIG: configPath },
      encoding: 'utf8',
      timeout: 30000
    });

    const output = `${result.stdout || ''}${result.stderr || ''}`;

    expect(result.status).toBe(1);
    expect(output).toContain('Invalid tools config');
    expect(output).toContain('must be boolean');
    expect(output).not.toMatch(/^\s+at .+:\d+:\d+\)?$/m);   // no stack frames
    expect(output).not.toContain('node:internal');
  });

  test('the config shipped in the package satisfies its own schema', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.schema.json'), 'utf8'));
    const config = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.json'), 'utf8'));

    // Imported here rather than at the top so this file stays runnable in isolation.
    return import('../../lib/validation/index.js').then(({ validate }) => {
      expect(validate(schema, config).errors ?? []).toEqual([]);
    });
  });
});
