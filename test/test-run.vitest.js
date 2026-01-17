import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fetch from 'node-fetch';
import { requireRealCredentials } from './utils/credentials';

vi.setConfig({ testTimeout: 30000 });

const cliPath = path.join(process.cwd(), 'bin', 'pos-cli.js');

const waitForServer = async (port, maxWait = 5000) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) return true;
    } catch (e) {
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
};

const runCommand = (args, env = process.env) => {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });

    child.on('close', code => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', reject);
  });
};

describe('pos-cli test-run command', () => {
  let port = 0;

  beforeAll(async () => {
    const portArg = Math.floor(Math.random() * 10000) + 40000;
    port = portArg;
  });

  afterAll(async () => {
  });

  test('test run with no tests module should fail gracefully', async () => {
    requireRealCredentials();

    const { stdout, stderr, code } = await runCommand(['test', 'run', 'staging']);

    expect(code).not.toEqual(0);
    expect(stderr).toContain('Tests module not found');
  });
});
