import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import { isWizardTerminal, shortenHome } from '#lib/wizardUi.js';

describe('isWizardTerminal', () => {
  const saved = {};

  beforeEach(() => {
    saved.stdoutTTY = process.stdout.isTTY;
    saved.stdinTTY = process.stdin.isTTY;
    saved.columns = process.stdout.columns;
    process.stdout.isTTY = true;
    process.stdin.isTTY = true;
    process.stdout.columns = 80;
  });

  afterEach(() => {
    process.stdout.isTTY = saved.stdoutTTY;
    process.stdin.isTTY = saved.stdinTTY;
    process.stdout.columns = saved.columns;
    vi.unstubAllEnvs();
  });

  test('draws at a terminal', () => {
    vi.stubEnv('POS_CLI_SERVER_MODE', '');
    expect(isWizardTerminal()).toBe(true);
  });

  // stdout belongs to the protocol in server mode, and `error` would exit the server.
  test('never draws in server mode, even at a terminal', () => {
    vi.stubEnv('POS_CLI_SERVER_MODE', '1');
    expect(isWizardTerminal()).toBe(false);
  });
});

describe('shortenHome', () => {
  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/mk');
  });
  afterEach(() => vi.restoreAllMocks());

  test.each([
    ['Add this to /home/mk/.codex/config.toml:', 'Add this to ~/.codex/config.toml:'],
    ['Written in /home/mk.', 'Written in ~.'],
    // Someone else's home that merely starts with this one is not shortened into a path that does
    // not exist.
    ['Could not update /home/mkk/app/.codex/config.toml', 'Could not update /home/mkk/app/.codex/config.toml']
  ])('%s', (input, expected) => {
    expect(shortenHome(input)).toBe(expected);
  });
});
