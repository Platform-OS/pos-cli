
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// NOTE: keep imports single; file previously duplicated import lines causing parse error

const dummyInstance = {
  description: 'Generate something',
  _arguments: [{ name: 'name' }],
  argumentsHelp: () => '  name    # Name of thing',
  _options: [{ name: 'force', alias: 'f', description: 'force', default: '' }]
};

class DummyGen {}

const env = {
  register: vi.fn(),
  get: vi.fn(() => DummyGen),
  instantiate: vi.fn(() => dummyInstance),
  run: vi.fn(async () => {})
};

const listUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'generators', 'list.js')).href;
const helpUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'generators', 'help.js')).href;
const runUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'generators', 'run.js')).href;

describe('generators tools', () => {
  let listTool, helpTool, runTool;
  beforeAll(async () => {
    listTool = (await import(listUrl)).default;
    helpTool = (await import(helpUrl)).default;
    runTool = (await import(runUrl)).default;
  });

  test('list returns generators with required args', async () => {
    const res = await listTool.handler({}, { globSync: () => ['modules/core/generators/command/index.js'], yeomanEnv: env });
    expect(res.generators[0].name).toBe('command');
    expect(Array.isArray(res.generators[0].required)).toBe(true);
  });

  test('help returns usage, required and optional args, and options', async () => {
    const res = await helpTool.handler({ generatorPath: 'modules/core/generators/command' }, { yeomanEnv: env });
    expect(res.name).toBe('command');
    expect(res.usage).toMatch(/pos-cli generate/);
    expect(res.optionsTable).toMatch(/--force/);
    expect(Array.isArray(res.requiredArgs)).toBe(true);
    expect(Array.isArray(res.optionalArgs)).toBe(true);
  });

  test('run triggers yeoman env run', async () => {
    const res = await runTool.handler({ generatorPath: 'modules/core/generators/command', args: ['users/create'], options: { force: true } }, { yeomanEnv: env });
    expect(res.ok).toBe(true);
    expect(env.run).toHaveBeenCalled();
  });
});
