/**
 * The documentation names tools that exist.
 *
 * Every MCP document in this repo once described a server that was never built — `localhost:3030`,
 * `clients.json`, tools called `platformos.logs.stream` — and the counts in docs/MCP_TOOLS.md kept
 * a `logs-stream` that is commented out in the registry. A reader cannot tell an invented tool from
 * a real one, and neither can a model reading the docs, so this checks the claim rather than
 * trusting the next editor to.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';

const REPO = path.resolve(import.meta.dirname, '../..');

// Every Markdown file a reader might take as current: the repository root and docs/. Listing
// files by hand is how `TOOLS.md` survived a sweep that deleted the four documents pointing at
// it — a file nothing links to is exactly the one nobody checks. CHANGELOG.md is excluded because
// it records what *was* true, including the names of things since removed.
const EXCLUDED = new Set(['CHANGELOG.md']);

// Tracked files only: a scratch note someone has not committed is not documentation, and failing
// their whole suite over it would teach them to distrust this test.
const tracked = new Set(
  execFileSync('git', ['ls-files', '*.md'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
);

const markdownIn = (dir) => fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !EXCLUDED.has(entry.name))
  .map(entry => (dir === '.' ? entry.name : `${dir}/${entry.name}`))
  .filter(file => tracked.has(file));

const DOCS = [...markdownIn('.'), ...markdownIn('docs'), 'mcp-min/README.md'];

// The prefixes tool names actually use. A hyphenated word starting with one of these reads as a
// tool name to anyone skimming, which is what makes a wrong one misleading.
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
  // Every one of these was in docs/API.md, docs/POS-CLI.md or docs/SSE_GUIDE.md, describing a
  // design that mcp-min never implemented. The ban is on the literals, not on the idea: the
  // server has no authentication of any kind, so a document naming one of these header or file
  // names is either wrong or about to be misread. Writing about redaction is possible without
  // them (see the logging section of CLAUDE.md).
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
