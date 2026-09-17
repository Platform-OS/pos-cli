/**
 * `annotations.readOnlyHint` tells MCP clients a tool changes nothing — not locally, not on the
 * instance — and clients may act on that without asking. The set is reviewed, not inferred: a
 * tool joins it here, with a reason, or not at all. Omitting the hint means "may change
 * things", which is the right default for everything else.
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
  'deploy-status',          // GET release
  'deploy-wait',            // polls GET release
  'data-import-status',     // GET job
  'data-export-status',     // GET job
  'data-clean-status',      // GET job
  'data-validate',          // validates local data against local schemas
  'tests-run-async-result', // GET test run result
  'constants-list',         // GraphQL query
  'partners-list',          // Partner Portal GET
  'partner-get',            // Partner Portal GET
  'endpoints-list'          // Partner Portal GET
];

describe('read-only annotations', () => {
  test('are on exactly the reviewed tools, and say nothing else', () => {
    const annotated = [...registry].filter(([, tool]) => tool.annotations).map(([name]) => name);

    expect(annotated.sort()).toEqual([...READ_ONLY].sort());
    for (const name of READ_ONLY) expect(registry.get(name).annotations, name).toEqual({ readOnlyHint: true });
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
        expect(annotations, name).toEqual(READ_ONLY.includes(name) ? { readOnlyHint: true } : undefined);
      }
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
