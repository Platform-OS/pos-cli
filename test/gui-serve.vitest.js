import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { requireRealCredentials } from './utils/credentials';

vi.setConfig({ testTimeout: 30000 });

const cliPath = path.join(process.cwd(), 'bin', 'pos-cli.js');

const waitForServer = async (port, maxWait = 10000) => {
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

const startServer = (args, env = process.env) => {
  const child = spawn('node', [cliPath, ...args], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', data => { stdout += data.toString(); });
  child.stderr.on('data', data => { stderr += data.toString(); });

  return {
    process: child,
    getStdout: () => stdout,
    getStderr: () => stderr,
    kill: () => {
      child.stdout.destroy();
      child.stderr.destroy();
      child.kill();
    }
  };
};

describe('pos-cli gui serve command', () => {
  let port = 0;

  beforeAll(async () => {
    const portArg = Math.floor(Math.random() * 10000) + 40000;
    port = portArg;
  });

  afterAll(async () => {
  });

  test('gui serve should start server without errors', async () => {
    requireRealCredentials();

    const server = startServer(['gui', 'serve', 'staging', '--port', port.toString()]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const serverReady = await waitForServer(port);

      expect(server.getStderr()).not.toContain('Cannot read properties of undefined');
      expect(server.getStderr()).not.toContain('TypeError');
      expect(server.getStderr()).not.toContain('ReferenceError');
      expect(server.getStderr()).not.toContain('SyntaxError');

      if (serverReady) {
        expect(server.getStdout()).toContain('Connected to');
        expect(server.getStdout()).toContain('Admin:');
        expect(server.getStdout()).toContain(`http://localhost:${port}`);
        expect(server.getStdout()).toContain('GraphiQL IDE:');
        expect(server.getStdout()).toContain('Liquid evaluator:');
      } else {
        expect(server.getStdout()).not.toContain('Connected to');
      }
    } finally {
      server.kill();
    }
  });
});
