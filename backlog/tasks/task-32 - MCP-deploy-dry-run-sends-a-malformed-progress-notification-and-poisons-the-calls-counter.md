---
id: TASK-32
title: >-
  MCP: deploy-dry-run sends a malformed progress notification and poisons the
  call's counter
status: Done
assignee: []
created_date: '2026-09-21 12:10'
updated_date: '2026-09-21 12:44'
labels:
  - mcp
  - deploy
  - agent-facing
dependencies: []
references:
  - mcp-min/deploy/dry-run.js
  - mcp-min/protocol/server-factory.js
  - mcp-min/jobs/status.js
  - mcp-min/__tests__/deploy.dry-run.test.js
modified_files:
  - mcp-min/protocol/server-factory.js
  - mcp-min/jobs/status.js
  - mcp-min/__tests__/protocol-conformance.test.js
  - mcp-min/__tests__/http-mcp-endpoint.test.js
  - mcp-min/__tests__/job-status.test.js
  - mcp-min/__tests__/tool-envelope.test.js
  - mcp-min/__tests__/deploy.dry-run.test.js
  - CLAUDE.md
priority: high
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`mcp-min/protocol/server-factory.js` hands every tool `ctx.sendProgress(progress, total, message)` — three positional arguments. `mcp-min/deploy/dry-run.js:153` calls it with a single object instead:

```js
ctx.sendProgress?.({ progress: 1, total: 2, message: 'Validating assets' });
```

Inside the reporter the first argument goes through `Math.max(progress, last + 1)`. An object coerces to NaN, so two things break at once:

- the notification that goes out carries `progress: null` (JSON has no NaN), which is not the number the protocol requires; and
- `last` is now NaN, so the 5 s heartbeat sends `progress: null` for the **rest of that call**. Nothing recovers it short of a new call.

Reproduced against the reporter's own arithmetic:

```
object form    -> {"progress":null}
next heartbeat -> {"progress":null,"message":"working"}
```

The failure is silent by construction: `progressReporter` sends through `.catch(err => log.debug(...))`, so whatever the client says about the malformed notification is swallowed at debug level and never reaches a person.

`mcp-min/jobs/status.js:122` calls the same function positionally and is correct, so the repository already contains both spellings with nothing to tell them apart. Correcting the one call site restores today's behaviour but leaves the next tool free to repeat it — three unnamed positional arguments of which two are optional is the shape that invited this. The fix should close the shape as well as the call, and it must not become a silent coercion: a tool passing nonsense should fail where it is written, not on the wire.

Found in the branch review of 2026-09-21. No test covers progress notifications from `deploy-dry-run`, which is why it shipped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A deploy-dry-run call made with a progress token receives notifications whose progress is an increasing number, asserted by a test that fails against the current code
- [x] #2 A tool that reports progress cannot put a non-numeric value on the wire: a wrong argument is rejected or refused where the tool makes the call, never coerced into null
- [x] #3 After a tool's own progress report, the heartbeat still increases monotonically for the whole life of the call, covered by a test
- [x] #4 Every ctx.sendProgress call site in mcp-min uses one agreed shape, and a test fails if a new call site diverges from it
- [x] #5 No progress notification is sent when the client passed no progress token — unchanged, and still covered
- [x] #6 If the call shape changes, CLAUDE.md's description of sendProgress in the protocol-layer section says the new one
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`ctx.sendProgress` now takes one named object, `{ progress, total?, message? }` — the shape the
notification itself has, and the shape `deploy-dry-run` was already using. The positional form is
gone, so the two call sites that disagreed cannot.

`progressReporter` (server-factory.js) splits in two:

- `send(report)` is what tools get. It validates before anything else and **before** the
  progress-token check, so misuse fails on the first client rather than on the first one that
  happens to ask for progress. `progress` must be a finite number and `total`, when given, too;
  either throws a `TypeError` where the tool wrote it. That is the same call this repo already
  makes in `ToolError`'s constructor for a bad kind: loud at the point of a programming error
  rather than quiet on the wire. `runTool` turns it into an `internal` failure, so a misused
  progress call fails that one call and nothing else.
- `emit(progress, total, message)` keeps the counter and sends. It assumes a checked value, and the
  heartbeat calls it directly — a validating heartbeat could throw from inside its `setInterval`,
  which is an uncaught exception, which in this server is the whole process.

`total != null` became `total !== undefined`, since `null` no longer reaches `emit`.

Call sites changed: `jobs/status.js` (which also loses its positional `undefined` placeholder) and
the three test tools. `deploy/dry-run.js` was already correct and is untouched.

**Bite checks**, each with a sha256-verified restore:

- reporter reverted to positional → all 6 conformance progress cases fail (both eras), plus the
  HTTP `/mcp` SSE progress case
- `deploy/dry-run.js` reverted to the positional call → the new dry-run shape test fails, and the
  source scan reports it

`job-status.test.js`'s existing progress assertion read `mock.calls[0][2]`; it failed on the first
run of the change, which is the test doing its job, and now reads the object.

The heartbeat test was rewritten rather than duplicated: `test-quiet` now reports once before going
quiet, so the following heartbeat proves the counter survived a tool's own report — the second half
of the defect — at no extra runtime.

1416 mcp-min tests pass.
<!-- SECTION:NOTES:END -->
