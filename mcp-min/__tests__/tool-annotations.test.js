/**
 * Annotations are what a client gates on, so both sets are reviewed rather than inferred: a tool
 * joins one here, with a reason, or carries nothing.
 *
 * `readOnlyHint` says a tool changes nothing, locally or on the instance, and clients may run it
 * without asking. Omitting it means "may change things", which is the right default.
 *
 * `destructiveHint` is only meaningful when `readOnlyHint` is absent, and the MCP specification
 * already defaults it to true there — so stating it changes nothing for a compliant client. It is
 * stated anyway on the four tools that can delete, because that is the judgement most expensive to
 * get wrong, clients differ in how they treat an absent default, and a reviewed list is a thing a
 * person can check. It is deliberately not spread across every writing tool: "may change things"
 * is what the absence already says.
 */
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';
import startHttp from '../http-server.js';
import { defaultTools } from './helpers/tools.js';

const READ_ONLY = [
  'envs-list',              // reads .pos
  'logs-fetch',             // GET logs
  'generators-list',        // scans generator files
  'generators-help',        // reads one generator
  'migrations-list',        // GET migrations
  'job-status',             // GET the status of a job started earlier
  'data-validate',          // validates local data against local schemas
  'constants-list',         // GraphQL query
  'partners-list',          // Partner Portal GET
  'partner-get',            // Partner Portal GET
  'endpoints-list'          // Partner Portal GET
];

// Tools that can remove something a person would miss. Each deletes on the instance, not locally.
const DESTRUCTIVE = [
  'data-clean',      // deletes every record, and the instance files with includeSchema
  'constants-unset', // deletes a constant
  'deploy-start',    // a deploy that is not partial deletes whatever is missing from the build
  'sync-file'        // deletes the file on the instance when op is delete
];

// Stated false rather than left absent: `deploy-dry-run` sits beside `deploy-start`, which is
// destructive, and the specification's default for an absent `destructiveHint` is true. Silence
// would put the safe tool in the same bucket as the dangerous one it exists to precede. It is not
// `readOnlyHint` either — it records a release on the instance and writes an archive locally.
const NOT_DESTRUCTIVE = [
  'deploy-dry-run'   // reports what a deploy would change; applies nothing
];

const EXPECTED = new Map([
  ...READ_ONLY.map(name => [name, { readOnlyHint: true }]),
  ...DESTRUCTIVE.map(name => [name, { destructiveHint: true }]),
  ...NOT_DESTRUCTIVE.map(name => [name, { destructiveHint: false }])
]);

describe('tool annotations', () => {
  test('are on exactly the reviewed tools, and say nothing else', () => {
    const annotated = [...registry].filter(([, tool]) => tool.annotations).map(([name]) => name);

    expect(annotated.sort()).toEqual([...EXPECTED.keys()].sort());
    for (const [name, annotations] of EXPECTED) expect(registry.get(name).annotations, name).toEqual(annotations);
  });

  // The two claims contradict each other: a tool that changes nothing cannot delete anything.
  test('no tool is marked both read-only and destructive', () => {
    expect(READ_ONLY.filter(name => DESTRUCTIVE.includes(name))).toEqual([]);
  });

  // A reviewed list stops being a review the moment it names something that is not there.
  test('both lists name registered tools', () => {
    expect([...READ_ONLY, ...DESTRUCTIVE].filter(name => !registry.has(name))).toEqual([]);
  });

  // Tools that run code on the instance or write files must never be marked.
  test.each(['graphql-exec', 'liquid-exec', 'check-run', 'unit-tests-run', 'data-clean', 'deploy-start', 'sync-file', 'env-add'])(
    '%s is not marked read-only', (name) => {
      expect(registry.get(name).annotations?.readOnlyHint).not.toBe(true);
    }
  );

  test('reach clients in tools/list', async () => {
    const server = await startHttp({ port: 0, tools: defaultTools() });
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/list' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } })
      });
      const { result } = await response.json();

      const listed = Object.fromEntries(result.tools.map(tool => [tool.name, tool.annotations]));
      for (const [name, annotations] of Object.entries(listed)) {
        expect(annotations, name).toEqual(EXPECTED.get(name));
      }
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
