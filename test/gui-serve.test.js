import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { requireRealCredentials } from './utils/credentials';

vi.setConfig({ testTimeout: 30000 });

const cliPath = path.join(process.cwd(), 'bin', 'pos-cli.js');
const fixturePath = path.join(process.cwd(), 'test', 'fixtures', 'deploy', 'correct_with_assets');

const waitForServer = async (server, port, maxWait = 5000, waitForSync = false) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const serverStarted = server.getStdout().includes('Connected to') &&
      server.getStdout().includes(`Admin: http://localhost:${port}`);

    if (serverStarted) {
      try {
        const response = await fetch(`http://localhost:${port}/`);
        if (response.ok) {
          if (waitForSync && !server.getStdout().includes('[Sync] Synchronizing changes to:')) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
          return true;
        }
      } catch {
        // JSON parse failed, ignore
      }
    }

    const serverHasError = server.getStderr().includes('Error') ||
      server.getStderr().includes('Failed') ||
      server.getStdout().includes('Error');
    if (serverHasError) {
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
};

const startServer = (args, env = process.env, cwd = process.cwd()) => {
  const child = spawn('node', [cliPath, ...args], {
    env: { ...process.env, ...env },
    cwd,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', data => {
    stdout += data.toString(); 
  });
  child.stderr.on('data', data => {
    stderr += data.toString(); 
  });

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

    try {
      const serverReady = await waitForServer(server, port);

      if (!serverReady) {
        await new Promise(resolve => setTimeout(resolve, 500));
        throw new Error(`Server could not start: ${server.getStdout()}\n${server.getStderr()}`);
      }

      expect(server.getStdout()).toContain('Connected to');
      expect(server.getStdout()).toContain('Admin:');
      expect(server.getStdout()).toContain(`http://localhost:${port}`);
      expect(server.getStdout()).toContain('GraphiQL IDE:');
      expect(server.getStdout()).toContain('Liquid evaluator:');
    } finally {
      server.kill();
    }
  });

  test('gui serve with --sync should start both server and sync', async () => {
    requireRealCredentials();

    const server = startServer(['gui', 'serve', 'staging', '--port', port.toString(), '--sync'], process.env, fixturePath);

    try {
      const serverReady = await waitForServer(server, port, 5000, true);

      if (!serverReady) {
        await new Promise(resolve => setTimeout(resolve, 500));
        throw new Error(`Server could not start: ${server.getStdout()}\n${server.getStderr()}`);
      }

      expect(server.getStdout()).toContain('Connected to');
      expect(server.getStdout()).toContain('Admin:');
      expect(server.getStdout()).toContain(`http://localhost:${port}`);
      expect(server.getStdout()).toContain('GraphiQL IDE:');
      expect(server.getStdout()).toContain('Liquid evaluator:');
      expect(server.getStdout()).toContain('[Sync] Synchronizing changes to:');
    } finally {
      server.kill();
    }
  });
});
