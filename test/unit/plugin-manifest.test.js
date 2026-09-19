/**
 * `plugin/.claude-plugin/marketplace.json` registers pos-cli's language server with Claude Code.
 * Nothing in the repository imports it and no code path reads it, so every way it can break is
 * silent: a renamed bin leaves it pointing at a command that does not exist, and dropping it from
 * package.json's `files` leaves it working for anyone who cloned the repo and broken for everyone
 * who installed the package. These are the checks that would have caught either.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, test, expect } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'plugin', '.claude-plugin', 'marketplace.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const pluginNamed = (name) => manifest.plugins.find(p => p.name === name);
const plugin = pluginNamed('platformos-lsp');
const reminders = pluginNamed('platformos-lsp-reminders');

describe('the Claude Code plugin manifest', () => {
  test('the language server and the reminders are separate plugins, installable on their own', () => {
    expect(plugin).toBeDefined();
    expect(reminders).toBeDefined();
    // With `source: "./"` the marketplace directory is also the plugin directory, which is what
    // keeps the language-server plugin a single file.
    expect(plugin.source).toBe('./');

    // The reminders plugin must declare no language server of its own. Two plugins mapping the
    // same extension is an lsp-extension-conflict, which is what someone installing both would hit.
    expect(reminders.lspServers).toBeUndefined();
  });

  test('the reminders plugin ships the files its hook names', () => {
    const root = path.join(ROOT, 'plugin', 'reminders');
    expect(fs.existsSync(path.join(root, 'hooks', 'hooks.json'))).toBe(true);

    const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
    const commands = hooks.hooks.PostToolUse.flatMap(entry => entry.hooks.map(h => h.command));
    expect(commands.length).toBeGreaterThan(0);

    // A hook naming a script that is not there fails silently on every edit.
    for (const command of commands) {
      const scriptPath = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/)?.[1];
      expect(scriptPath, `cannot tell which file ${command} runs`).toBeDefined();
      expect(fs.existsSync(path.join(root, scriptPath)), `${scriptPath} is missing`).toBe(true);
    }
  });

  test('every language server it declares runs a command this package installs', () => {
    const bins = Object.keys(pkg.bin);
    const servers = Object.entries(plugin.lspServers ?? {});
    expect(servers.length).toBeGreaterThan(0);

    for (const [name, server] of servers) {
      expect(bins, `${name} runs "${server.command}", which package.json does not install`)
        .toContain(server.command);
    }
  });

  test('the command it names is a real file, not just a bin entry', () => {
    for (const [name, server] of Object.entries(plugin.lspServers)) {
      const target = path.join(ROOT, pkg.bin[server.command]);
      expect(fs.existsSync(target), `${name} points at ${pkg.bin[server.command]}, which is missing`).toBe(true);
    }
  });

  /**
   * The server takes five options through initializationOptions, and the defaults are the right
   * ones here — measured against a 1,956-file app:
   *
   *   platformosCheck.checkOnOpen (true)   didOpen is Claude Code's ONLY trigger; it sends no
   *                                        didChange and no didSave. false → zero diagnostics.
   *   platformosCheck.includeFilesFromDisk (false)
   *                                        true lints the whole project rather than the opened
   *                                        file: nothing published within 25 s, against 29
   *                                        diagnostics promptly on the default.
   *   platformosCheck.preloadOnBoot (true) no measurable effect either way (3.8 s vs 3.9 s to
   *                                        first diagnostics, same 29).
   *   platformosCheck.checkOnSave, .checkOnChange
   *                                        unreachable — Claude Code sends neither notification.
   *
   * So this asserts we pass none of them. Adding one is a deliberate act that should come with
   * its own measurement.
   */
  test('passes no initializationOptions, because the defaults are the measured best', () => {
    for (const server of Object.values(plugin.lspServers)) {
      expect(server.initializationOptions).toBeUndefined();
      expect(server.settings).toBeUndefined();
    }
  });

  test('it maps the extensions a platformOS project is written in', () => {
    const extensions = Object.keys(plugin.lspServers['platformos-liquid'].extensionToLanguage);
    expect(extensions).toContain('.liquid');
    expect(extensions).toContain('.graphql');
    // Claude Code lowercases extensions when it builds its map, so an uppercase key would never match.
    for (const ext of extensions) {
      expect(ext, 'an extension key must start with a dot and be lowercase').toBe(ext.toLowerCase());
      expect(ext.startsWith('.')).toBe(true);
    }
  });

  test('npm ships it', () => {
    // The manifest lives under a dot-directory, so it reaches an installed copy only because
    // `plugin` is listed here. Without it the plugin works from a clone and from nowhere else.
    expect(pkg.files).toContain('plugin');
  });

  test('the marketplace carries the identity the install commands use', () => {
    // `claude plugin install platformos-lsp@platformos` names both halves; either one drifting
    // breaks the documented command while leaving the manifest valid.
    expect(manifest.name).toBe('platformos');
    expect(plugin.name).toBe('platformos-lsp');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(plugin.description?.length ?? 0).toBeGreaterThan(20);
  });
});

/**
 * The reminders hook runs after every Write/Edit in a session that has it installed, so its
 * failure modes are the ones that matter: it must say nothing about files it has no business
 * commenting on, and it must never fail the tool call that triggered it.
 */
describe('the reminders hook', () => {
  const SCRIPT = path.join(ROOT, 'plugin', 'reminders', 'scripts', 'post-tool-use.js');

  const run = (input) => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: typeof input === 'string' ? input : JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10000
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };

  const edit = (file_path) => ({ tool_name: 'Edit', tool_input: { file_path }, cwd: '/tmp' });

  test.each([
    'app/views/pages/index.liquid',
    'app/graphql/find.graphql',
    // Claude Code lowercases extensions for its own map, so the server handles these too.
    'weird.LIQUID',
    'x.GraphQL'
  ])('nudges after editing %s', (file) => {
    const { status, stdout } = run(edit(file));

    expect(status).toBe(0);
    const payload = JSON.parse(stdout);
    expect(payload.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(payload.hookSpecificOutput.additionalContext).toContain(file);
    const text = payload.hookSpecificOutput.additionalContext;
    // The point of the nudge is the action, so it has to name the operations — and only the two
    // this server answers. Naming findReferences or workspaceSymbol would send the agent at an
    // `Unhandled method` error.
    expect(text).toMatch(/hover/);
    expect(text).toMatch(/goToDefinition/);
    expect(text).not.toMatch(/findReferences|workspaceSymbol|goToImplementation|documentSymbol|CallHierarchy/i);
    // Short enough to be worth printing on every edit.
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  test.each([
    'lib/ai.js',
    'README.md',
    'app/config.yml',
    'package.json',
    // Near misses: the extension must end the name, and a bare dotfile has no name to extend.
    'notes.liquid.bak',
    'app/assets/liquid',
    'a.graphqls',
    '.liquid',
    'app/.liquid'
  ])('says nothing after editing %s', (file) => {
    const { status, stdout } = run(edit(file));
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  // A hook that throws, hangs or exits non-zero would break the edit that triggered it.
  test.each([
    ['input that is not JSON', 'not json at all'],
    ['empty input', ''],
    ['no tool_input', { tool_name: 'Edit', cwd: '/tmp' }],
    ['a file_path that is not a string', { tool_name: 'Edit', tool_input: { file_path: 42 } }],
    ['null file_path', { tool_name: 'Edit', tool_input: { file_path: null } }]
  ])('survives %s without output or failure', (_label, input) => {
    const { status, stdout, stderr } = run(input);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });
});
