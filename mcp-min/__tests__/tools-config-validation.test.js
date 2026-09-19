/**
 * tools.config.json decides which tools the MCP server exposes, so a config that does not
 * match tools.config.schema.json must stop the server rather than be ignored — ignoring it
 * would silently re-enable every tool the author meant to switch off.
 *
 * One loader (tools-config.js) owns reading and judging the file, and both the server and
 * `pos-cli mcp-config` go through it, so the two cannot disagree about a config.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import registry from '../tools.js';
import log from '../log.js';
import { loadToolsConfig, toolsConfigLocation, isDisabledByConfig, BUNDLED_CONFIG_PATH, REMOVED_TOOLS } from '../tools-config.js';
import { selectTools } from '../tool-selection.js';
import { MCP_BIN, MCP_CONFIG_BIN, serverEnv, launch, request, stop, stopAll } from './helpers/server-process.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

let tmpDir;

const write = (name, contents) => {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, contents);
  return file;
};

const load = configPath => loadToolsConfig(registry, { env: { MCP_TOOLS_CONFIG: configPath } });

// A rejected config must come out as a ToolsConfigError carrying the message, not as some
// other error that happens to stop startup.
const rejection = configPath => {
  try {
    load(configPath);
  } catch (err) {
    return err;
  }
  throw new Error(`expected ${configPath} to be rejected`);
};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-tools-config-'));
});

afterAll(async () => {
  await stopAll();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tools config validation', () => {
  test('refuses a config field with the wrong type', () => {
    const err = rejection(write('wrong-type.json', JSON.stringify({ tools: { 'envs-list': { enabled: 'yes' } } })));

    expect(err.name).toBe('ToolsConfigError');
    expect(err.message).toContain('/tools/envs-list/enabled must be boolean');
  });

  test('refuses a config that is not an object', () => {
    expect(rejection(write('array.json', JSON.stringify(['envs-list']))).message).toContain('Invalid tools config');
  });

  // These parse as valid JSON but are not configs. Testing the parsed value for
  // truthiness would skip validation and fall through to defaults with everything on.
  test.each(['null', 'false', '0', '""'])('refuses a bare %s config', literal => {
    const err = rejection(write(`falsy-${literal.replace(/\W/g, '_')}.json`, literal));

    expect(err.name).toBe('ToolsConfigError');
    expect(err.message).toContain('Invalid tools config');
    expect(err.message).toContain('must be object');
  });

  // The schema constrains each entry's shape but cannot enumerate tool names, so this
  // is the case it structurally cannot catch: a typo leaves the real tool enabled while
  // the config looks like it took effect.
  test('refuses a config that names a tool that does not exist', () => {
    const err = rejection(write('typo.json', JSON.stringify({ tools: { 'deploy-strt': { enabled: false } } })));

    expect(err.name).toBe('ToolsConfigError');
    expect(err.message).toContain('no such tool: deploy-strt');
  });

  test('names every unknown tool, not just the first', () => {
    const err = rejection(write('typos.json', JSON.stringify({
      tools: { 'deploy-strt': { enabled: false }, 'constants-lst': { enabled: false } }
    })));

    expect(err.message).toContain('no such tool: deploy-strt, constants-lst');
  });

  // `name in registry` would accept these, because `in` walks the prototype chain — they
  // would then match nothing and be silently ignored.
  test.each(['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__'])(
    'refuses a config keyed by the inherited property %s',
    key => {
      // JSON.parse makes `__proto__` an own key, which is what a config file would contain.
      const configPath = write(`proto-${key}.json`, `{"tools":{${JSON.stringify(key)}:{"enabled":false}}}`);

      expect(rejection(configPath).message).toContain(`no such tool: ${key}`);
    }
  );

  test('a config naming only real tools loads, and its description reaches the exposed tool', () => {
    const configPath = write('real.json', JSON.stringify({ tools: { 'deploy-start': { description: 'Ship it' } } }));

    expect(load(configPath)).toMatchObject({ path: configPath, source: 'MCP_TOOLS_CONFIG', state: 'loaded' });
    const { tools } = selectTools({ env: { MCP_TOOLS_CONFIG: configPath } });
    expect(tools.get('deploy-start').description).toBe('Ship it');
    expect(registry.get('deploy-start').description).not.toBe('Ship it');
  });

  test('a valid config disables the named tool', () => {
    const configPath = write('valid.json', JSON.stringify({ tools: { 'envs-list': { enabled: false } } }));
    const { tools, hidden } = selectTools({ env: { MCP_TOOLS_CONFIG: configPath } });

    expect(tools.has('envs-list')).toBe(false);
    expect(hidden).toContainEqual({ name: 'envs-list', reason: 'disabled' });
    // No entry means enabled, so naming one tool hides one tool.
    expect(tools.size).toBe(registry.size - 1);
  });

  test.each([
    ['missing', () => path.join(tmpDir, 'absent.json')],
    ['unparseable', () => write('broken.json', '{ "tools": {')],
    ['unreadable', () => tmpDir]
  ])('a %s config falls back to defaults and says so', (state, configPath) => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const loaded = load(configPath());

    expect(loaded).toMatchObject({ state, config: { tools: {} } });
    expect(selectTools({ env: { MCP_TOOLS_CONFIG: configPath() } }).tools.size).toBe(registry.size);
    // Named explicitly through MCP_TOOLS_CONFIG, so the fallback is worth a warning.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`is ${state}; using defaults`));
  });

  test('a config that loads is not warned about', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    load(write('quiet.json', JSON.stringify({ tools: {} })));

    expect(warn).not.toHaveBeenCalled();
  });

  test('MCP_TOOLS_CONFIG replaces the bundled config; without it the bundled one is used', () => {
    expect(toolsConfigLocation({})).toEqual({ path: BUNDLED_CONFIG_PATH, source: 'bundled' });
    expect(toolsConfigLocation({ MCP_TOOLS_CONFIG: '/x/tools.json' })).toEqual({ path: '/x/tools.json', source: 'MCP_TOOLS_CONFIG' });
    expect(toolsConfigLocation({ MCP_TOOLS_CONFIG: '' })).toEqual({ path: BUNDLED_CONFIG_PATH, source: 'bundled' });
  });

  test('the disabled rule reads own entries only', () => {
    const config = JSON.parse('{"tools":{"check":{"enabled":false},"envs-list":{}}}');

    expect(isDisabledByConfig(config, 'check')).toBe(true);
    expect(isDisabledByConfig(config, 'envs-list')).toBe(false);
    expect(isDisabledByConfig(config, 'deploy-start')).toBe(false);
    expect(isDisabledByConfig(config, 'constructor')).toBe(false);
  });

  test('the config shipped in the package satisfies its own schema', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.schema.json'), 'utf8'));
    const config = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools.config.json'), 'utf8'));

    return import('../../lib/validation/index.js').then(({ validate }) => {
      expect(validate(schema, config).errors ?? []).toEqual([]);
    });
  });
});

/**
 * A tool is described where it is defined, and nowhere else.
 *
 * The bundled config used to carry a description for every tool, and the loader prefers the
 * config's, so editing a module changed nothing a client saw — six pairs had drifted apart before
 * anyone noticed. The override stays, for a config a user writes; what is gone is the shipped file
 * exercising it by default, which also froze all 36 descriptions for anyone who edited the file.
 */
describe('the bundled config asserts only what departs from the code', () => {
  const bundled = () => JSON.parse(fs.readFileSync(BUNDLED_CONFIG_PATH, 'utf8'));

  test('it redescribes nothing, so a tool is described where it is defined', () => {
    const redescribed = Object.entries(bundled().tools)
      .filter(([, entry]) => entry.description !== undefined)
      .map(([name]) => name);

    expect(redescribed, 'describe a tool in its own module; this file is for departures').toEqual([]);
  });

  test('what a client is shown is what the tool module wrote, for every tool', () => {
    const { tools } = selectTools({ env: {} });

    for (const [name, exposed] of tools) {
      expect(exposed.description, name).toBe(registry.get(name).description);
    }
  });

  test('it records no entry that only restates a default', () => {
    const redundant = Object.entries(bundled().tools)
      .filter(([, entry]) => Object.keys(entry).length === 0 || entry.enabled === true)
      .map(([name]) => name);

    expect(redundant, 'an entry that changes nothing is noise the next reader has to check').toEqual([]);
  });
});

// Users were told to copy the bundled file and edit it, so one written against an earlier release
// is still out there with all 36 descriptions in it. It has to keep working.
describe('a config written for an earlier release still applies', () => {
  test('naming a tool that has since been removed is a warning, not a refusal to start', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const configPath = write('names-removed.json', JSON.stringify({ tools: { check: { enabled: false } } }));

    // The unknown-name rule exists to catch a typo that would silently leave a tool enabled. A
    // removed tool cannot leave anything enabled, and the user could not have edited the line out
    // before upgrading, so refusing to start would break the upgrade over nothing.
    expect(() => load(configPath)).not.toThrow();
    expect(selectTools({ env: { MCP_TOOLS_CONFIG: configPath } }).tools.size).toBe(registry.size);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('check, which no longer exists'));
  });

  test('a typo is still refused, even beside a removed tool', () => {
    const configPath = write('typo-and-removed.json', JSON.stringify({ tools: { check: {}, 'deploy-strt': { enabled: false } } }));

    expect(rejection(configPath).message).toContain('no such tool: deploy-strt');
    expect(rejection(configPath).message).not.toContain('check');
  });

  test('no tombstone shadows a tool that is registered today', () => {
    const shadowed = [...REMOVED_TOOLS.keys()].filter(name => registry.has(name));

    expect(shadowed, 'a re-registered tool must lose its tombstone, or its config entry is ignored').toEqual([]);
  });

  test('its descriptions still reach clients, and the tools it disabled stay disabled', () => {
    const asShippedBefore = {
      tools: Object.fromEntries(
        [...registry.keys()].map(name => [name, { enabled: name !== 'data-clean', description: `Old text for ${name}` }])
      )
    };
    const configPath = write('old-shape.json', JSON.stringify(asShippedBefore));

    const { tools } = selectTools({ env: { MCP_TOOLS_CONFIG: configPath } });

    expect(tools.has('data-clean')).toBe(false);
    expect(tools.size).toBe(registry.size - 1);
    expect(tools.get('envs-list').description).toBe('Old text for envs-list');
  });
});

// Both callers of the loader, run as users run them.
describe('the server and pos-cli mcp-config judge a config the same way', () => {
  const run = (bin, configPath, args = []) => {
    const result = spawnSync(process.execPath, [bin, ...args], {
      cwd: repoRoot,
      env: serverEnv(tmpDir, { MCP_TOOLS_CONFIG: configPath, MCP_MIN_PORT: '0' }),
      input: '',
      encoding: 'utf8',
      timeout: 30000
    });
    return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
  };

  // CLAUDE.md requires user-facing errors to go through the logger. A module-loader
  // stack trace reaching the terminal is the failure mode this guards.
  test('an invalid config stops both with the same message, not a stack trace', () => {
    const configPath = write('for-cli.json', JSON.stringify({ tools: { 'envs-list': { enabled: 'yes' } } }));
    const server = run(MCP_BIN, configPath);
    const config = run(MCP_CONFIG_BIN, configPath);

    for (const result of [server, config]) {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Invalid tools config');
      expect(result.stderr).toContain('must be boolean');
      expect(result.stderr).not.toMatch(/^\s+at .+:\d+:\d+\)?$/m); // no stack frames
      expect(result.stderr).not.toContain('node:internal');
    }
    expect(config.stderr.trim()).toBe(server.stderr.trim());
  });

  test('pos-cli mcp-config shows a valid override, as the source, with what it disables', () => {
    const configPath = write('shown.json', JSON.stringify({ tools: { 'envs-list': { enabled: false } } }));
    const { status, stdout } = run(MCP_CONFIG_BIN, configPath);

    expect(status).toBe(0);
    expect(stdout).toContain(`Config: ${configPath} (MCP_TOOLS_CONFIG)\n`);
    expect(stdout).toMatch(/^ {2}envs-list +disabled in the tools config$/m);

    const json = JSON.parse(run(MCP_CONFIG_BIN, configPath, ['--json']).stdout);
    expect(json.config).toEqual({ path: configPath, source: 'MCP_TOOLS_CONFIG', state: 'loaded' });
    expect(json.hidden).toEqual([{ name: 'envs-list', reason: 'disabled' }]);
    expect(json.exposed.map(t => t.name)).toEqual([...registry.keys()].filter(name => name !== 'envs-list'));
  });

  test('the server starts with a named config that is missing, exposing every tool and warning', async () => {
    const configPath = path.join(tmpDir, 'server-nowhere.json');
    const proc = launch({ workDir: tmpDir, env: { MCP_TOOLS_CONFIG: configPath, MCP_MIN_PORT: '0' } });
    try {
      await request(proc, { jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } } });
      const list = await request(proc, { jsonrpc: '2.0', id: 'list', method: 'tools/list', params: {} });

      expect(list.result.tools.map(t => t.name)).toEqual([...registry.keys()]);
      expect(proc.stderr).toContain(`mcp-min: tools config ${configPath} is missing; using defaults`);
    } finally {
      await stop(proc);
    }
  }, 30000);

  test('pos-cli mcp-config says when the named config is missing and defaults apply', () => {
    const configPath = path.join(tmpDir, 'nowhere.json');
    const { status, stdout } = run(MCP_CONFIG_BIN, configPath);

    expect(status).toBe(0);
    expect(stdout).toContain(`Config: ${configPath} (MCP_TOOLS_CONFIG) — not found, so no tool is disabled or redescribed\n`);
    expect(stdout).toContain(`Exposed (${registry.size}):`);
  });

  test('without MCP_TOOLS_CONFIG, pos-cli mcp-config names the bundled config', () => {
    const result = spawnSync(process.execPath, [MCP_CONFIG_BIN], { cwd: repoRoot, env: serverEnv(tmpDir), encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Config: ${BUNDLED_CONFIG_PATH} (default (bundled))\n`);
  });
});
