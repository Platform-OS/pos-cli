/**
 * docs/MCP_COVERAGE.md records, for every pos-cli capability, whether the MCP server exposes it and
 * why. A document like that decays the moment someone adds a CLI command, so this test derives the
 * capability list from `bin/` the way commander does and holds the two together: a new command has
 * no row and fails here until its meaning for the agent surface is written down.
 *
 * It deliberately does not check the *reasons* — those are for a human. It checks that a decision
 * exists, that it is one of the four, and that anything claiming to be covered or tracked actually
 * points at a tool in the registry or a task in the backlog.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BIN = path.join(ROOT, 'bin');
const DOC = path.join(ROOT, 'docs', 'MCP_COVERAGE.md');

const DECISIONS = new Set(['exposed', 'expose', 'later', 'never']);

/**
 * The commands one bin file declares. Comments are stripped first: `pos-cli-uploads.js` carries a
 * commented-out `pull`, and counting it would demand a decision about a command nobody can run.
 */
const subcommandsOf = (parts) => {
  const file = path.join(BIN, `pos-cli${parts.length ? `-${parts.join('-')}` : ''}.js`);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const names = [...src.matchAll(/\.command\(\s*['"]([^'"\s]+)/g)].map(m => m[1]);
  return names.length ? names : null;
};

/** Every leaf command, as a user types it: a node with no subcommand file of its own. */
const cliCapabilities = () => {
  const leaves = [];
  const walk = (parts) => {
    const subs = subcommandsOf(parts);
    if (!subs) {
      if (parts.length) leaves.push(parts.join(' '));
      return;
    }
    for (const sub of subs) walk([...parts, sub]);
  };
  walk([]);
  return leaves;
};

/** The decision table, as rows. The reason column is free text and is not parsed. */
const decisionRows = () => {
  const lines = fs.readFileSync(DOC, 'utf8').split('\n');
  const rows = [];
  for (const line of lines) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([a-z]+)\s*\|\s*([^|]*)\|/);
    if (m) rows.push({ capability: m[1].trim(), decision: m[2].trim(), pointer: m[3].trim() });
  }
  return rows;
};

const backlogTaskIds = () => {
  const ids = new Set();
  for (const dir of ['tasks', 'completed']) {
    const d = path.join(ROOT, 'backlog', dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const m = f.match(/^task-([\d.]+)\s/);
      if (m) ids.add(`TASK-${m[1]}`);
    }
  }
  return ids;
};

describe('docs/MCP_COVERAGE.md covers the CLI', () => {
  const capabilities = cliCapabilities();
  const rows = decisionRows();
  const byCapability = new Map(rows.map(r => [r.capability, r]));

  // If this ever reads zero, every assertion below passes vacuously.
  test('the CLI surface is actually being walked', () => {
    expect(capabilities.length).toBeGreaterThan(50);
    expect(capabilities).toContain('deploy');
    expect(capabilities).toContain('modules overwrites diff');
    // Commented-out commands are not capabilities: `uploads pull` is commented out in bin/.
    expect(capabilities).not.toContain('uploads pull');
  });

  test('every CLI capability has a recorded decision', () => {
    const undecided = capabilities.filter(c => !byCapability.has(c));
    expect(undecided, `add a row to docs/MCP_COVERAGE.md for: ${undecided.join(', ')}`).toEqual([]);
  });

  test('no row describes a capability the CLI no longer has', () => {
    const cliSet = new Set(capabilities);
    const stale = rows.map(r => r.capability).filter(c => !cliSet.has(c));
    expect(stale, `remove these rows from docs/MCP_COVERAGE.md: ${stale.join(', ')}`).toEqual([]);
  });

  test('each capability appears exactly once', () => {
    const seen = new Map();
    for (const r of rows) seen.set(r.capability, (seen.get(r.capability) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([c]) => c)).toEqual([]);
  });

  test('every decision is one of the four', () => {
    const bad = rows.filter(r => !DECISIONS.has(r.decision));
    expect(bad.map(r => `${r.capability}: ${r.decision}`)).toEqual([]);
  });
});

describe('the decisions point at things that exist', () => {
  const rows = decisionRows();

  test('every "exposed" row names a tool the registry has', () => {
    const missing = rows
      .filter(r => r.decision === 'exposed')
      .map(r => ({ capability: r.capability, tool: (r.pointer.match(/`([^`]+)`/) || [])[1] }))
      .filter(({ tool }) => !tool || !registry.has(tool));
    expect(missing, 'an exposed capability must name a registered tool').toEqual([]);
  });

  test('every "expose" row names a task in the backlog', () => {
    const ids = backlogTaskIds();
    const missing = rows
      .filter(r => r.decision === 'expose')
      .map(r => ({ capability: r.capability, task: (r.pointer.match(/TASK-[\d.]+/) || [])[0] }))
      .filter(({ task }) => !task || !ids.has(task));
    expect(missing, 'a capability marked expose must be tracked by a real task').toEqual([]);
  });

  // A "never" is a judgement about the capability, not a deferral, so it must not be waiting on work.
  test('no "never" row points at a task', () => {
    const tracked = rows.filter(r => r.decision === 'never' && /TASK-[\d.]+/.test(r.pointer));
    expect(tracked.map(r => r.capability)).toEqual([]);
  });

  test('every tool in the registry is reachable from some capability or listed as MCP-only', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    const unmentioned = [...registry.keys()].filter(name => !doc.includes(`\`${name}\``));
    expect(unmentioned, 'document these under "Tools with no CLI equivalent"').toEqual([]);
  });
});
