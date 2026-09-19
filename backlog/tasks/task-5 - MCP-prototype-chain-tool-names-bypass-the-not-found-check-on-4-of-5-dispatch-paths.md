---
id: TASK-5
title: >-
  MCP: prototype-chain tool names bypass the not-found check on 4 of 5 dispatch
  paths
status: Done
assignee: []
created_date: '2026-09-02 10:22'
updated_date: '2026-09-17 13:12'
labels:
  - bug
  - security
  - mcp
dependencies: []
references:
  - mcp-min/http-server.js
  - mcp-min/stdio-server.js
  - mcp-min/tools.js
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`, unrelated to the Ajv validation branch, but found while reviewing it.

The tool registry (`mcp-min/tools.js`) is a plain object literal, and four of the five dispatch sites look a tool up with a bare `tools[name]` and test only truthiness. Names inherited from `Object.prototype` therefore resolve to something truthy that is not a tool. Reproduced against a running `startHttp`:

```
POST /call {"tool":"constructor"} -> 500 {"error":"TypeError: entry.handler is not a function"}
POST /call {"tool":"toString"}    -> 500 {"error":"TypeError: entry.handler is not a function"}
```

`constructor`, `toString`, `valueOf`, `hasOwnProperty` and `__proto__` all behave this way. The affected sites:

- `mcp-min/http-server.js:93` — `POST /call`
- `mcp-min/http-server.js:226` — `POST /call-stream`, legacy branch
- `mcp-min/stdio-server.js:82` — MCP `tools/call`
- `mcp-min/stdio-server.js:171` — legacy direct invocation

The JSON-RPC branch in the same file already gets it right (`mcp-min/http-server.js:189`: `if (!entry || typeof entry.handler !== 'function')`) and correctly answers `-32601 Tool not found`, which is the behaviour the other four should match.

There is a worse variant in the stdio protocol dispatcher. `mcp-min/stdio-server.js:164` does `const mcpHandler = mcpHandlers[method]`, and `mcpHandlers` is also a plain object literal. A request with `method: "toString"` resolves to `Object.prototype.toString`, which is invoked, returns a string, and **sends no response at all** — the client waits for its `id` until it times out.

Impact is bounded (the MCP server is a local developer tool, and no state is reachable this way) but it is a trivially reachable internal error and a hang from untrusted client input, on the surface this codebase is currently hardening for audit. Fix with `Object.hasOwn` or the `typeof handler === 'function'` guard, applied consistently at all five sites, and make the stdio protocol dispatcher fall through to its existing `-32601 Method not found` path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A tools/call or /call request naming constructor, toString, valueOf, hasOwnProperty or __proto__ is answered as tool-not-found (404 / -32601), not as a 500 or an internal TypeError
- [x] #2 A stdio request whose method is an Object.prototype name is answered as method-not-found rather than receiving no response
- [x] #3 All five dispatch sites use the same lookup guard
- [x] #4 Tests cover at least one prototype-chain name on each transport, including the stdio protocol dispatcher hang
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implemented with TASK-13 Part 1 (2026-09-17)
- **One lookup.** The exposed tools are a `Map`, and every dispatch path looks them up with `findTool` (`mcp-min/tool-selection.js`): stdio `tools/call`, stdio direct method, `POST /call`, `POST /call-stream`, and JSON-RPC `tools/call` (which also keeps its handler check). `Object.prototype` names therefore come back not-found, and so do tools the selection hides.
- **stdio protocol dispatcher.** The handler lookup uses `typeof method === 'string' && Object.hasOwn(mcpHandlers, method)`. `toString`, `constructor`, `valueOf`, `hasOwnProperty` and `__proto__` fall through to `-32601 Method not found` instead of running the prototype function and answering nothing.
- **Tests** (`mcp-min/__tests__/tool-surface.test.js`, spawned `pos-cli-mcp`):
  - each of the 6 dispatch variants (stdio tools/call, stdio direct method as JSON-RPC and legacy, HTTP /call, /call-stream, JSON-RPC tools/call) answers `constructor`, `toString`, `__proto__` and `hasOwnProperty` with its not-found response, with a positive control per path
  - the dispatcher answers all 5 prototype method names
  - `tool-selection.test.js` covers `findTool` on prototype names and non-string names
- **Bite check.** Against the committed code with every tool exposed, 25 tests fail: prototype names get past the lookup on 5 of 6 variants, and the 5 dispatcher methods time out with no response. Only the already-guarded JSON-RPC tools/call passes.
- **Mutation check.** S1 (dispatcher guard removed), S5 and H6 (Object.prototype fallback on stdio and HTTP) and T14 (findTool fallback) were all killed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Prototype-chain names are unknown tools and methods on every MCP path

**Before**
- `POST /call {"tool":"constructor"}` answered 500 (`TypeError: entry.handler is not a function`).
- `POST /call-stream` opened a stream only to report that the tool has no stream handler.
- stdio `tools/call` and direct method calls returned the TypeError as a JSON-RPC error.
- A stdio request whose method was `toString`, `constructor`, `valueOf` or `hasOwnProperty` got no response at all, so the client waited until it timed out.

**After**
- Tools are held in a `Map`, and all five dispatch sites resolve names through one guard, `findTool`. They answer `404` / `-32601` for inherited names exactly as for any other unknown name.
- The stdio protocol dispatcher matches only its own handlers and answers `-32601 Method not found` for inherited names.

**Tests**
- Spawned-server tests cover every transport and dispatch variant, plus the stdio dispatcher's missing responses.
- 25 of them fail on the previous code.
- Mutation-tested.
<!-- SECTION:FINAL_SUMMARY:END -->
