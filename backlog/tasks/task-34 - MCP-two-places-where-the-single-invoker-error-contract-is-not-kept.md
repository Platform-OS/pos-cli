---
id: TASK-34
title: 'MCP: two places where the single-invoker error contract is not kept'
status: Done
assignee: []
created_date: '2026-09-21 12:11'
updated_date: '2026-09-21 13:05'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/uploads/push.js
  - mcp-min/run-tool.js
  - mcp-min/tool-error.js
  - mcp-min/protocol/server-factory.js
modified_files:
  - mcp-min/tool-error.js
  - mcp-min/run-tool.js
  - mcp-min/uploads/push.js
  - mcp-min/protocol/server-factory.js
  - mcp-min/http-server.js
  - mcp-min/README.md
  - mcp-min/__tests__/uploads.push.test.js
  - mcp-min/__tests__/tool-envelope.test.js
  - mcp-min/__tests__/http-mcp-endpoint.test.js
priority: medium
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two small, independent defects in the envelope `mcp-min/run-tool.js` owns. Same neighbourhood, one PR.

**1. `uploads-push` tells the agent to retry our own bugs.**

`mcp-min/uploads/push.js:54`:

```js
const kind = status >= 400 ? kindForStatus(status) : 'unavailable';
```

A failure carrying no HTTP status is classified `unavailable`, whose documented meaning in `ERROR_KINDS` is "nothing was decided; the same call may work later". A `TypeError` in our own code has no status, so a defect in pos-cli is reported to the agent as a transient condition and it retries a call that cannot succeed. `classify` in `mcp-min/run-tool.js` already answers this exact question and answers it correctly — a network code becomes `unavailable`, anything else without a status becomes `internal` — and this is the only place in the server that re-derives the judgement instead of asking for it.

The tool is right to keep its own `code`: `UPLOAD_FAILED` names which leg failed, which only this tool knows, and the comment above it says so. The *kind* is not its to decide, which is the same reasoning that moved twenty tools off their own catch-all codes in the first place.

**2. `DOUBLE_ENVELOPE` cannot name the tool it is about.**

`mcp-min/run-tool.js:105` builds its message from `tool.name ?? 'tool'`. No registry entry carries a `name` property — verified across all 30 — because the name is the Map key, not a field on the value. So the one diagnostic written to catch a half-converted handler always reads `tool returned a result envelope`, naming nothing. `registerTool` in `protocol/server-factory.js` has the name in hand and does not pass it on.

This error exists precisely because the drift it catches is otherwise silent. A diagnostic that cannot say which tool drifted is most of the way to no diagnostic.

Found in the branch review of 2026-09-21.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A failure from uploads-push that carries no HTTP status is classified the way the invoker classifies it, with a network failure and a programming error covered by separate tests
- [x] #2 uploads-push still reports the UPLOAD_FAILED code and still records which file it was, unchanged
- [x] #3 No tool re-derives an error kind from a status independently of the shared table; a test fails if one starts to
- [x] #4 The DOUBLE_ENVELOPE error names the tool that returned the envelope, asserted by a test
- [x] #5 Neither change alters what a successful call returns on any transport
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**1. `classify` moved from `run-tool.js` to `tool-error.js`,** with `UNCLASSIFIED`, `networkCode`
and `UNREACHABLE`. Not tidying: `uploads-push` needs the judgement, and importing it from
`run-tool.js` would make a tool depend on the thing that calls tools — the only such edge in the
server. `tool-error.js` is where the judgement already lives (`kindForStatus` is there for exactly
the "one answer, one place" reason), `classify` needs nothing but `ToolError` and that table, and
the module still imports nothing. Nothing outside `run-tool.js` imported `classify`, so the move is
invisible.

`uploads-push` then reduces to `new ToolError(classify(e).kind, 'UPLOAD_FAILED', …)`. Details stay
`{ filePath }` — `classify`'s own `statusCode`/`body` are deliberately not merged in, because AC #2
says what this tool reports about itself is unchanged, and pulling an upstream body into the result
is TASK-37's question, not this one.

**2. `toolName` is an input to `runTool`, not part of the handler context.** The signature is
`runTool(tool, params, { toolName, ...ctx })`, so the name is destructured off before `ctx` reaches
the handler — CLAUDE.md documents that context as `{ transport, debug, log, sendProgress, signal }`
and it stays true. All three dispatch paths pass it: `registerTool` (stdio and `/mcp`) and both
deprecated HTTP routes.

Rejected: putting `name` on the registry entries. `tools.js` would have to spread each tool into a
new object, which breaks `expect(registry.get('deploy-dry-run')).toBe(dryRunTool)` — a test worth
keeping — and mutating the imported module objects instead is worse. A fourth positional argument
was also rejected, for the reason TASK-32 exists.

**3. The AC #3 scan took two attempts, and the first one was wrong.**

First attempt matched lines mentioning `kind` or `ToolError` that also contained a kind name as a
string. My own bite check broke it: renaming the local from `kind` to `k` walked straight past it.
Rewritten to match any kind literal by position, it then fired on `portal/env-add.js`'s background
waiter returning `{ status: 'cancelled' }` — that waiter's own vocabulary, not a kind, and exactly
the false alarm this file's other comments warn about. `input` and `instance` are ordinary words
here too; a scan for kind *names* cannot work.

The shipped scan matches the **argument position** instead: the kind handed to `new ToolError` must
be `<something>.kind` or `kindForStatus(...)`. No English collisions, no dependence on what anyone
names a variable, and it catches both shapes of the defect — a literal and a hand-computed local.

It is honestly limited, and the comment says so: it cannot see whether `ToolError.<kind>()` was
reached for inside a catch block, because that needs parsing rather than matching. The per-tool
error tests cover intent; the scan covers the shape.

**Bite checks**, each with a sha256-verified restore:

- `uploads-push` reverted to the local `'unavailable'` fallback → the `internal` case fails, and
  the scan names the file. Re-run with the local renamed to `whatever`, to prove the scan does not
  depend on the spelling.
- kind written as a literal → scan reports `new ToolError('unavailable', …)`
- `server-factory` stops passing `toolName` → the end-to-end naming test fails on both eras
- `runTool` forwards `toolName` instead of stripping it → the context test fails

The naming test lives in `http-mcp-endpoint.test.js` against a real `startHttp` server with a
`test-half-converted` tool, not only as a `runTool` unit test: a unit test proves `runTool` *can*
use a name, and would still pass if every dispatch path forgot to send one.

1424 mcp-min tests pass; `test/unit` is unchanged at 1317 with the same pre-existing TASK-9 failure.
<!-- SECTION:NOTES:END -->
