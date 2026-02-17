
import { pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, test, expect, beforeAll } from 'vitest';

const checkRunModPath = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'check', 'run.js')).href;

describe('platformos.check-run', () => {
  let checkRunTool;

  beforeAll(async () => {
    const mod = await import(checkRunModPath);
    checkRunTool = mod.default;
  });

  test('has correct description', () => {
    expect(checkRunTool.description).toContain('platformos-check');
    expect(checkRunTool.description).toContain('Node.js');
  });

  test('has input schema with expected properties', () => {
    expect(checkRunTool.inputSchema.type).toBe('object');
    expect(checkRunTool.inputSchema.properties.appPath).toBeDefined();
    expect(checkRunTool.inputSchema.properties.autoFix).toBeDefined();
  });

  test('returns PATH_NOT_FOUND for non-existent path', async () => {
    const result = await checkRunTool.handler({ appPath: '/tmp/does-not-exist-xyz-123' });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PATH_NOT_FOUND');
    expect(result.error.message).toContain('/tmp/does-not-exist-xyz-123');
  });

  test('returns NOT_A_DIRECTORY for file path', async () => {
    // Use a file that definitely exists
    const tmpFile = path.join(os.tmpdir(), 'check-run-test-file.txt');
    fs.writeFileSync(tmpFile, 'test', 'utf8');

    try {
      const result = await checkRunTool.handler({ appPath: tmpFile });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_A_DIRECTORY');
      expect(result.error.message).toContain(tmpFile);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('includes timing metadata on success or dependency error', async () => {
    const result = await checkRunTool.handler({ appPath: '.' });

    if (result.ok) {
      // theme-check-node is installed
      expect(result.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.meta.appPath).toBeDefined();
      expect(result.data).toBeDefined();
      expect(typeof result.data.offenseCount).toBe('number');
      expect(typeof result.data.filesChecked).toBe('number');
      expect(typeof result.data.autoFixed).toBe('boolean');
      expect(result.data.autoFixed).toBe(false);
      expect(Array.isArray(result.data.files)).toBe(true);
    } else {
      // theme-check-node is not installed — graceful handling
      expect(result.error.code).toBe('MISSING_DEPENDENCY');
      expect(result.error.message).toContain('theme-check-node');
    }
  });

  test('returns structured file data when dependency is available', async () => {
    const result = await checkRunTool.handler({ appPath: '.' });

    if (!result.ok && result.error.code === 'MISSING_DEPENDENCY') {
      // Skip — dependency not installed
      return;
    }

    expect(result.ok).toBe(true);
    expect(typeof result.data.errorCount).toBe('number');
    expect(typeof result.data.warningCount).toBe('number');
    expect(typeof result.data.infoCount).toBe('number');
    expect(typeof result.data.fileCount).toBe('number');

    // Verify each file entry structure
    for (const file of result.data.files) {
      expect(typeof file.path).toBe('string');
      expect(Array.isArray(file.offenses)).toBe(true);
      expect(typeof file.errorCount).toBe('number');
      expect(typeof file.warningCount).toBe('number');
      expect(typeof file.infoCount).toBe('number');
    }
  });
});
