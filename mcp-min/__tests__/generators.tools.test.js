
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { runTool } from '../run-tool.js';

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
  let listTool, helpTool, runGeneratorTool;
  beforeAll(async () => {
    listTool = (await import(listUrl)).default;
    helpTool = (await import(helpUrl)).default;
    runGeneratorTool = (await import(runUrl)).default;
  });

  test('list returns generators with required args, and says nothing when all of them read', async () => {
    const res = await runTool(listTool, {}, { globSync: () => ['modules/core/generators/command/index.js'], yeomanEnv: env });
    expect(res.data.generators[0].name).toBe('command');
    expect(Array.isArray(res.data.generators[0].required)).toBe(true);
    // An empty `unreadable` on every call is a field the model reads past to learn nothing.
    expect(res.data).not.toHaveProperty('unreadable');
  });

  test('help returns usage, required and optional args, and options', async () => {
    const res = await runTool(helpTool, { generatorPath: 'modules/core/generators/command' }, { yeomanEnv: env });
    expect(res.data.name).toBe('command');
    expect(res.data.usage).toMatch(/pos-cli generate/);
    expect(res.data.optionsTable).toMatch(/--force/);
    expect(Array.isArray(res.data.requiredArgs)).toBe(true);
    expect(Array.isArray(res.data.optionalArgs)).toBe(true);
  });

  // Through the invoker, which is what builds `ok`: the tool returns only what it produced.
  test('run triggers yeoman env run', async () => {
    const res = await runTool(runGeneratorTool, { generatorPath: 'modules/core/generators/command', args: ['users/create'], options: { force: true } }, { yeomanEnv: env });

    expect(res.ok).toBe(true);
    expect(env.run).toHaveBeenCalled();
  });

  test('a generator called without its required arguments is the caller\'s mistake, not a run', async () => {
    // The shared dummy declares `name` without `required`, so nothing would be missing from it.
    const demanding = { ...env, instantiate: vi.fn(() => ({ ...dummyInstance, _arguments: [{ name: 'name', required: true }] })) };
    const res = await runTool(runGeneratorTool, { generatorPath: 'modules/core/generators/command', args: [] }, { yeomanEnv: demanding });

    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'input', code: 'MISSING_REQUIRED_ARGUMENTS' });
    expect(res.error.details.required).toEqual(['name']);
  });

  test('a generator that is not there is reported as missing, not as a pos-cli defect', async () => {
    const missing = { ...env, get: vi.fn(() => { throw new Error('Cannot find module /nope/index.js'); }) };
    const res = await runTool(helpTool, { generatorPath: 'modules/core/generators/nope' }, { yeomanEnv: missing });

    expect(res.ok).toBe(false);
    expect(res.error).toMatchObject({ kind: 'not_found', code: 'GENERATOR_NOT_FOUND' });
  });

  test('a generator whose help cannot be read is named, not returned as taking no arguments', async () => {
    const broken = { ...env, instantiate: vi.fn(() => { throw new Error('boom'); }) };
    const res = await runTool(listTool, {}, { globSync: () => ['modules/core/generators/command/index.js'], yeomanEnv: broken });

    expect(res.ok).toBe(true);
    expect(res.data.generators).toEqual([]);
    expect(res.data.unreadable).toMatchObject([{ name: 'command', reason: expect.stringContaining('boom') }]);
  });
});
