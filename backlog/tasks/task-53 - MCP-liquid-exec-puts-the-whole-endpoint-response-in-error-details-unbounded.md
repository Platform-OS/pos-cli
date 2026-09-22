---
id: TASK-53
title: 'MCP: liquid-exec puts the whole endpoint response in error details, unbounded'
status: To Do
assignee: []
created_date: '2026-09-22 12:55'
labels:
  - mcp
  - payload
dependencies: []
priority: low
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`mcp-min/liquid/exec.js` answers a failed render with `ToolError.instance('LIQUID_EXEC_ERROR', message, resp)` — the endpoint's entire response object as `details`.

`boundedDetails` (`tool-error.js`) caps `details.body` and nothing else, so `details.result` travels whole. That field is the rendered output, and a template can fail *after* rendering most of a page: the failure path is the one where an arbitrarily large payload reaches the model, while it is already dealing with an error.

The message itself is fine — it is the Liquid error line, which is the thing the caller needs.

Found during the TASK-40–46 review and left alone: it predates those tasks, and the right fix is a decision about `boundedDetails` rather than a cap bolted onto one thrower — the same argument that put the body bound in `toResult` in the first place.

Two candidate shapes:
- Bound `details.result` the way `details.body` is bound, in `boundedDetails`, so every thrower inherits it.
- Or have `liquid-exec` pass only the fields the caller acts on (`error`, `errors`, `diagnostic`) — cheaper, but an allowlist that will go stale, which is the trade `job-status` deliberately refused for the release record.

Prefer the first: it keeps the rule where every error becomes a result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Liquid failure that rendered a large page does not put the whole rendering in the error details
- [ ] #2 The Liquid error message and the `diagnostic.stack` line numbers still arrive intact — they are the only way a caller finds the fault in its own template
- [ ] #3 Whatever bound is chosen lives where every error becomes a result, not at this one thrower
- [ ] #4 A test renders past the ceiling, fails, and asserts what came back is bounded and still diagnosable
<!-- AC:END -->
