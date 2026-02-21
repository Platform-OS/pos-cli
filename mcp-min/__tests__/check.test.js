
import { pathToFileURL } from 'url';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { describe, test, expect, beforeAll } from 'vitest';

const execAsync = promisify(exec);
const checkModPath = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'check', 'index.js')).href;

let cliAvailable = false;

describe('platformos.check', () => {
  let checkTool;

  beforeAll(async () => {
    const mod = await import(checkModPath);
    checkTool = mod.default;

    // Check if platformos-check CLI is available
    try {
      await execAsync('platformos-check --version');
      cliAvailable = true;
    } catch {
      cliAvailable = false;
    }
  });

  test('has correct description', () => {
    expect(checkTool.description).toContain('platformos-check');
    expect(checkTool.description).toContain('Liquid');
  });

  test('has input schema with required properties', () => {
    expect(checkTool.inputSchema.type).toBe('object');
    expect(checkTool.inputSchema.properties.appPath).toBeDefined();
    expect(checkTool.inputSchema.properties.format).toBeDefined();
    expect(checkTool.inputSchema.properties.autoCorrect).toBeDefined();
    expect(checkTool.inputSchema.properties.list).toBeDefined();
  });

  test('lists enabled checks with list=true', async () => {
    const result = await checkTool.handler({ list: true });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CHECK_ERROR');
      return;
    }

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.listChecks).toBe(true);
    expect(typeof result.data.result).toBe('string');
    expect(result.data.result).toMatch(/SyntaxError|InvalidArgs|MissingTemplate/);
  });

  test('prints config with print=true', async () => {
    const result = await checkTool.handler({ print: true });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CHECK_ERROR');
      return;
    }

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.printConfig).toBe(true);
    expect(typeof result.data.result).toBe('string');
    expect(result.data.result.length).toBeGreaterThan(100);
  });

  test('runs check and returns results', async () => {
    const result = await checkTool.handler({ format: 'json', appPath: '.' });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CHECK_ERROR');
      return;
    }

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.format).toBe('json');
    expect(result.data.appPath).toBe('.');
    expect(result.meta).toBeDefined();
    expect(result.meta.startedAt).toBeDefined();
    expect(result.meta.finishedAt).toBeDefined();
  });

  test('accepts multiple categories as array', async () => {
    const result = await checkTool.handler({
      format: 'json',
      category: ['liquid', 'html'],
      appPath: '.'
    });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      return;
    }

    expect(result.ok).toBe(true);
  });

  test('accepts excludeCategory as array', async () => {
    const result = await checkTool.handler({
      format: 'json',
      excludeCategory: ['performance'],
      appPath: '.'
    });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      return;
    }

    expect(result.ok).toBe(true);
  });

  test('handles autoCorrect parameter', async () => {
    const result = await checkTool.handler({
      format: 'json',
      autoCorrect: true,
      appPath: '.',
      list: false
    });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      return;
    }

    expect(result.ok).toBe(true);
    expect(result.data.autoCorrect).toBe(true);
  });

  test('includes timing metadata', async () => {
    const result = await checkTool.handler({ list: true });

    if (!cliAvailable) {
      expect(result.ok).toBe(false);
      return;
    }

    expect(result.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
