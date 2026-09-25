---
id: TASK-53
title: 'MCP: liquid-exec puts the whole endpoint response in error details, unbounded'
status: Done
assignee: []
created_date: '2026-09-22 12:55'
updated_date: '2026-09-23 17:15'
labels:
  - mcp
  - payload
dependencies: []
modified_files:
  - mcp-min/tool-error.js
  - mcp-min/liquid/exec.js
  - mcp-min/__tests__/tool-envelope.test.js
  - mcp-min/__tests__/liquid.exec.test.js
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
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
- [x] #1 A Liquid failure that rendered a large page does not put the whole rendering in the error details
- [x] #2 The Liquid error message and the `diagnostic.stack` line numbers still arrive intact — they are the only way a caller finds the fault in its own template
- [x] #3 Whatever bound is chosen lives where every error becomes a result, not at this one thrower
- [x] #4 A test renders past the ceiling, fails, and asserts what came back is bounded and still diagnosable
<!-- AC:END -->



## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed, and the defect was larger than this task described: the rendered page reached the model **twice**, not once.

## The half this task did not name: the message

```js
const message = String(resp?.error || resp?.errors || resp?.result || 'Liquid execution failed');
```

A template can fail *after* rendering most of a page. The endpoint then answers with its own `error` null and `Liquid error (line N): …` rendered into the output — which is exactly the case the `/liquid error/i.test(rendered)` marker at line 78 exists for, and the case the 6.6.0 entry "reported a successful render as a failure whenever the output contained the word error" narrowed the *detection* for without touching the *message*.

So on that path `message` was the whole rendered page, and `details.result` was the whole rendered page. Bounding only `details.result`, as this task proposed, would have shipped the identical payload through a field nothing bounds — and `message` is what a model reads first.

## Why `upstreamBody` could not be reused for `result`

The task's preferred shape was "bound `details.result` the way `details.body` is bound". Bounding it *in `boundedDetails`* is right; bounding it *the way `body` is* is not. `upstreamBody` replaces an HTML page with `HTML error page: <title> (N bytes, not shown)`. Rendered output that fails after building a page **is** an HTML page, so it would have been labelled an error page — false, it is the caller's own output — and the inline `Liquid error` line, which in this shape is the only statement of what went wrong, would have been discarded.

## What was done

**1. `boundedDetails` caps every string, not just `body`** (`tool-error.js`). Naming the fields to bound is an allowlist the next thrower will not know about, which is the argument that put the bound in `toResult` to begin with. `body` keeps its own rule — HTML reduced to its `<title>`, parsed JSON never cut — and **nested values are left alone**, which is what preserves the existing deliberate decision that a parsed JSON body arrives whole (`tool-envelope.test.js`, "a JSON body is never cut, however long"). A recursive walk would have broken that decision, so it was rejected.

`MAX_ERROR_BODY_LENGTH` → `MAX_DETAILS_STRING_LENGTH`, since it no longer bounds only bodies. The tail is factored into `capped`, which `upstreamBody` now ends with, so both produce the identical `… (N more characters)` suffix.

**2. The message is the error lines lifted out of the output** (`liquid/exec.js`). Distinct lines only — one failing partial in a loop renders the same line once per iteration — at most ten, and each match ends at the next newline, the next `<`, or 200 characters.

That last bound came from a test failure, not from foresight: the first version used `[^\n]*`, and rendered HTML is frequently one long line, so the "error line" took the rest of the document with it. The test asserting the clean line caught it.

The endpoint's own `error` still wins when there is one. `errors` handling is unchanged — it has no evidence of ever being returned, and changing it here would be speculative.

## Measured

A 30 KB page that failed after rendering: the error result went from **60,282 bytes to 4,269** — 93% less, on the failure path, where the model is already dealing with a problem.

## Testing

Six new tests in `liquid.exec.test.js` (17 → 23) and three in `tool-envelope.test.js`.

Bite-checked by breaking each guarantee on purpose, all six caught:

| Breakage | Failed |
| --- | --- |
| `boundedDetails` back to `body`-only (the filed defect) | 2 |
| message back to the whole rendered output | 4 |
| match runs to end of line only | 2 |
| no dedupe of repeated identical errors | 1 |
| no cap on the number of distinct errors | 1 |
| `body` loses its own HTML/JSON rule | 3 |

Both files restored and verified by sha256 afterwards.

Full `mcp-min` suite: 1579 passing, 2 failing — both `Test timed out in 10000ms` in `tools-config-validation.test.js`, which spawns real processes. That file passes 34/34 in isolation both with these changes and on a stashed clean tree, so the timeouts are parallel-load flakes and not caused by this work.
<!-- SECTION:FINAL_SUMMARY:END -->
