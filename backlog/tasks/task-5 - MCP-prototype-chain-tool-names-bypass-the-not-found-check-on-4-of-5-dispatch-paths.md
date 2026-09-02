---
id: TASK-5
title: >-
  MCP: prototype-chain tool names bypass the not-found check on 4 of 5 dispatch
  paths
status: To Do
assignee: []
created_date: '2026-09-02 10:22'
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
ordinal: 20000
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
- [ ] #1 A tools/call or /call request naming constructor, toString, valueOf, hasOwnProperty or __proto__ is answered as tool-not-found (404 / -32601), not as a 500 or an internal TypeError
- [ ] #2 A stdio request whose method is an Object.prototype name is answered as method-not-found rather than receiving no response
- [ ] #3 All five dispatch sites use the same lookup guard
- [ ] #4 Tests cover at least one prototype-chain name on each transport, including the stdio protocol dispatcher hang
<!-- AC:END -->
