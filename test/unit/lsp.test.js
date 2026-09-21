import { describe, test, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import cli from '#test/utils/exec';
import cliScript from '#test/utils/cliPath';

vi.setConfig({ testTimeout: 15000 });

const spawnLsp = (args = []) => {
  const child = spawn(process.execPath, [cliScript, 'lsp', ...args], {
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
      const { stdout } = await cli('lsp --help');

      expect(stdout).toMatch('Usage: pos-cli lsp');
      expect(stdout).toMatch('Language Server Protocol');
    });

    test('lsp is listed in main help', async () => {
      const { stdout } = await cli('--help');

      expect(stdout).toMatch('lsp');
      expect(stdout).toMatch('Language Server Protocol');
    });
  });

  /**
   * `--stdio` is what nearly every LSP client sends: vscode-languageclient passes it by default,
   * editor configurations spell it out, and it is the first thing anyone types when checking a
   * server by hand. This server speaks stdio and nothing else, so the flag asks for what it
   * already does — but commander rejected it as an unknown option, and a correct invocation
   * therefore looked like a broken install.
   */
  describe('the transport flag clients actually send', () => {
    test('--stdio is accepted and changes nothing', async () => {
      const server = spawnLsp(['--stdio']);

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        expect(server.getExitCode(), server.getStderr()).toBeNull();
        expect(server.getStderr()).not.toMatch(/unknown option/);
      } finally {
        server.kill();
      }
    });

    test('it is documented, so a reader does not have to guess', async () => {
      const { stdout } = await cli('lsp --help');

      expect(stdout).toMatch('--stdio');
    });

    // Being liberal about `--stdio` is not being liberal about everything: a client asking for a
    // transport this server does not serve has to hear so, rather than be handed a stdio server
    // that will never answer it.
    test('a transport that is not served is still refused', async () => {
      const { stderr, code } = await cli('lsp --node-ipc').catch(e => e);

      expect(`${stderr}`).toMatch(/unknown option/);
      expect(code).not.toBe(0);
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
