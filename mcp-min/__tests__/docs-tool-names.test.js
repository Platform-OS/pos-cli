/**
 * The documentation names tools that exist. A reader cannot tell an invented tool name from a real
 * one, and neither can a model reading the docs.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';

const REPO = path.resolve(import.meta.dirname, '../..');

// Every Markdown file a reader might take as current, discovered rather than listed: a file
// nothing links to is exactly the one nobody checks. CHANGELOG.md is excluded because it records
// what *was* true, including the names of things since removed.
const EXCLUDED = new Set(['CHANGELOG.md']);

// Tracked files only: a scratch note someone has not committed is not documentation.
const tracked = new Set(
  execFileSync('git', ['ls-files', '*.md'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
);

const markdownIn = (dir) => fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !EXCLUDED.has(entry.name))
  .map(entry => (dir === '.' ? entry.name : `${dir}/${entry.name}`))
  .filter(file => tracked.has(file));

const DOCS = [...markdownIn('.'), ...markdownIn('docs'), 'mcp-min/README.md'];

// A hyphenated word starting with one of these reads as a tool name to anyone skimming, which is
// what makes a wrong one misleading.
const TOOL_PREFIXES = /^(envs?|logs|liquid|graphql|generators|migrations|job|deploy|data|unit|tests|check|sync|uploads|constants|instance|partners?|endpoints)-/;

// Hyphenated words that start like a tool name but are not one. Each needs a reason: this list is
// the only way a genuine mistake can hide from this test.
const NOT_TOOLS = new Map([
  ['deploy-strt', 'the typo in the example of an unknown-tool error message'],
  ['data-import-export', 'a path in a documentation.platformos.com URL'],
  ['data-operations', 'a heading anchor in docs/MCP_TOOLS.md'],
  ['instance-uuid', 'a field in an API response'],
  ['partner-portal-url', 'a pos-cli env add flag'],
  ['check-node-version', 'scripts/check-node-version.js'],
  ['check-init', 'the pos-cli check init command'],
  ['check-run-with-autofix', 'prose about check-run'],
  ['job-status-tool', 'prose'],
  ['tests-config', 'prose'],
  ['data-clean-up', 'prose']
]);

const mentionedIn = (text) => {
  const found = new Set();
  for (const [, name] of text.matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)) found.add(name);
  return [...found].filter(name => TOOL_PREFIXES.test(name));
};

describe('tool names in the documentation', () => {
  test.each(DOCS)('%s names only registered tools', (file) => {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');

    const unknown = mentionedIn(text).filter(name => !registry.has(name) && !NOT_TOOLS.has(name));

    expect(unknown, `${file} names tools that mcp-min/tools.js does not register`).toEqual([]);
  });

  // The other direction: a tool nobody documents is one nobody finds.
  test('docs/MCP_TOOLS.md names every registered tool', () => {
    const text = fs.readFileSync(path.join(REPO, 'docs/MCP_TOOLS.md'), 'utf8');

    const undocumented = [...registry.keys()].filter(name => !text.includes(`\`${name}\``));

    expect(undocumented).toEqual([]);
  });

  test('the allowlist carries no name that is in fact a tool', () => {
    expect([...NOT_TOOLS.keys()].filter(name => registry.has(name))).toEqual([]);
  });
});

describe('the server the documentation describes is the one that ships', () => {
  // The ban is on the literals, not on the idea: the server has no authentication of any kind, so
  // a document naming one of these is either wrong or about to be misread.
  test.each([
    ['port 3030', /\b3030\b/],
    ['a clients.json of client secrets', /clients\.json/i],
    ['an x-api-key header', /x-api-key/i],
    ['Zod validation', /\bzod\b/i],
    ['dotted tool names', /platformos\.(logs|env|graphql|liquid|deploy|data)\./]
  ])('no document mentions %s', (_label, pattern) => {
    const offenders = DOCS.filter(file => pattern.test(fs.readFileSync(path.join(REPO, file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
