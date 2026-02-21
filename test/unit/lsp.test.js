import { describe, test, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';

vi.setConfig({ testTimeout: 15000 });

const spawnLsp = () => {
  const binPath = path.join(process.cwd(), 'bin', 'pos-cli.js');
  const child = spawn('node', [binPath, 'lsp'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  let exitCode = null;

  child.stdout.on('data', data => { stdout += data.toString(); });
  child.stderr.on('data', data => { stderr += data.toString(); });
  child.on('exit', code => { exitCode = code; });

  return {
    getStdout: () => stdout,
    getStderr: () => stderr,
    getExitCode: () => exitCode,
    kill: () => {
      child.stdout.destroy();
      child.stderr.destroy();
      child.kill();
    }
  };
};

describe('pos-cli lsp', () => {
  describe('Help text', () => {
    test('shows correct usage and description', async () => {
      const { stdout } = await exec(`${cliPath} lsp --help`);

      expect(stdout).toMatch('Usage: pos-cli lsp');
      expect(stdout).toMatch('Language Server Protocol');
    });

    test('lsp is listed in main help', async () => {
      const { stdout } = await exec(`${cliPath} --help`);

      expect(stdout).toMatch('lsp');
      expect(stdout).toMatch('Language Server Protocol');
    });
  });

  describe('LSP server', () => {
    test('starts and stays alive (stdio LSP server)', async () => {
      const server = spawnLsp();

      try {
        // Give the server a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // A null exit code means the process is still running - which is correct
        // for a long-running LSP server that listens on stdio
        expect(server.getExitCode()).toBeNull();
      } finally {
        server.kill();
      }
    });

    test('does not write anything to stdout on startup (LSP uses stdio for protocol messages)', async () => {
      const server = spawnLsp();

      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        // LSP server must not emit anything to stdout before receiving a client message,
        // as stdout is reserved exclusively for the JSON-RPC protocol
        expect(server.getStdout()).toBe('');
      } finally {
        server.kill();
      }
    });
  });
});
