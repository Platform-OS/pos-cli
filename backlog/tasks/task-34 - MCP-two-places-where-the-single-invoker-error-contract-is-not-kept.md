---
id: TASK-34
title: 'MCP: two places where the single-invoker error contract is not kept'
status: To Do
assignee: []
created_date: '2026-09-21 12:11'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/uploads/push.js
  - mcp-min/run-tool.js
  - mcp-min/tool-error.js
  - mcp-min/protocol/server-factory.js
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
- [ ] #1 A failure from uploads-push that carries no HTTP status is classified the way the invoker classifies it, with a network failure and a programming error covered by separate tests
- [ ] #2 uploads-push still reports the UPLOAD_FAILED code and still records which file it was, unchanged
- [ ] #3 No tool re-derives an error kind from a status independently of the shared table; a test fails if one starts to
- [ ] #4 The DOUBLE_ENVELOPE error names the tool that returned the envelope, asserted by a test
- [ ] #5 Neither change alters what a successful call returns on any transport
<!-- AC:END -->
