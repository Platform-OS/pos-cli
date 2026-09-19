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

  // A number a reader trusts and nobody recomputes. It said 35 while 36 shipped.
  test('docs/MCP_TOOLS.md counts the tools correctly', () => {
    const text = fs.readFileSync(path.join(REPO, 'docs/MCP_TOOLS.md'), 'utf8');

    expect(text).toContain(`**Total Tools**: ${registry.size}`);
  });
});

/**
 * Error codes in the reference are read as a contract: an agent branches on one, and a person
 * writing a client greps for it. Every code documented in an example has to be a code some tool can
 * actually produce — the reference carried five that no tool had ever emitted (`LIQUID_ERROR`,
 * `MISSING_ARGS`, `DEPLOY_FAILED`, `CONFIRMATION_MISMATCH`, `DELETE_REQUIRES_CONFIRMATION`), each
 * plausible enough that nobody checked.
 */
describe('error codes in the reference', () => {
  // A permissive scan of the sources rather than a parse of the throw sites: several codes are
  // computed (`ToolError[kind](...)`) or come from the record checks in lib-like modules, and a
  // scan that missed one would fail a document that is right. Over-collecting only weakens the
  // check; under-collecting breaks the build on correct documentation.
  const emittedCodes = () => {
    const codes = new Set();
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (entry.name.endsWith('.js')) {
          for (const [, code] of fs.readFileSync(full, 'utf8').matchAll(/'([A-Z][A-Z0-9_]{2,})'/g)) codes.add(code);
        }
      }
    };
    walk(path.join(REPO, 'mcp-min'));
    // Assigned by the invoker rather than written as a literal at a throw site.
    for (const code of ['INVALID_PARAMS', 'SCHEMA_ERROR', 'INTERNAL_ERROR']) codes.add(code);
    return codes;
  };

  test('every code an example shows is one a tool can produce', () => {
    const text = fs.readFileSync(path.join(REPO, 'docs/MCP_TOOLS.md'), 'utf8');
    const codes = emittedCodes();

    const documented = [...text.matchAll(/\bcode:\s*"([A-Z][A-Z0-9_]{2,})"/g)].map(m => m[1]);
    const invented = [...new Set(documented)].filter(code => !codes.has(code));

    expect(documented.length, 'the reference should show error codes at all').toBeGreaterThan(4);
    expect(invented, 'documented codes no tool emits').toEqual([]);
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

/**
 * The reference lists parameters per tool. Reworded prose there is harmless — the lists are
 * paraphrases, not copies — but a parameter the tool no longer declares is a caller following the
 * documentation into an INVALID_PARAMS, which is how `data-validate`'s `env` would have read after
 * it was removed.
 */
describe('docs/MCP_TOOLS.md parameters exist', () => {
  const text = fs.readFileSync(path.join(REPO, 'docs/MCP_TOOLS.md'), 'utf8');
  const sections = text.split(/^### /m).slice(1)
    .map(block => ({ name: block.split('\n', 1)[0].trim(), body: block }))
    .filter(section => registry.has(section.name));

  test('every tool section documents a tool that is registered', () => {
    expect(sections.length).toBeGreaterThan(20);
  });

  test.each(sections.map(s => [s.name, s.body]))('%s documents only parameters it declares', (name, body) => {
    const block = body.split('**Input Parameters**')[1];
    if (block === undefined) return;

    const documented = [...block.split(/\n\s*\n/)[0].matchAll(/^- `([A-Za-z0-9_]+)`/gm)].map(m => m[1]);
    const declared = Object.keys(registry.get(name).inputSchema?.properties ?? {});

    expect(documented.filter(param => !declared.includes(param)), `${name} documents parameters it does not accept`).toEqual([]);
  });
});
