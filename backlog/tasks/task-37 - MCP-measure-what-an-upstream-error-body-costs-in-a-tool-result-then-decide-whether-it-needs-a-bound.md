---
id: TASK-37
title: >-
  MCP: measure what an upstream error body costs in a tool result, then decide
  whether it needs a bound
status: To Do
assignee: []
created_date: '2026-09-21 12:12'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/run-tool.js
  - mcp-min/redact.js
  - mcp-min/protocol/server-factory.js
  - lib/apiRequest.js
priority: low
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`mcp-min/redact.js` bounds everything the log writes — 4096 characters per string, 100 array items, 100 object keys, depth 8 — on the stated reasoning that "the log is append-only and shared by every session on the machine, and a `data-import` payload can be megabytes".

The tool result has no equivalent bound, and one path puts an upstream response into it verbatim. `classify` in `mcp-min/run-tool.js:44` copies `err.response.body` into `details`, and `lib/apiRequest.js` sets that to the entire response text of any non-2xx (parsed as JSON when it parses, kept as text when it does not). `mcp-min/protocol/server-factory.js` then `JSON.stringify`s the whole result into the content block the model reads. An instance behind a proxy answering a 502 with an HTML page, or an application error page carrying a backtrace, lands in the model's context in full — paid in tokens, on a path nobody chose, at the moment the agent is already dealing with a failure.

**This is filed as a measurement, not a fix.** The case for a cap rests entirely on how large those bodies actually are in practice, and that has not been measured. A cap picked without the number is as likely to truncate the sentence that explains the failure as it is to save anything, and a truncated error is worse than a long one. Whoever picks this up measures first and only then decides; "no bound, here is why" is a perfectly good outcome and should be recorded as firmly as a bound would be.

The asymmetry itself is worth understanding either way: the log — private, on disk, owner-only — is bounded, and the tool result — sent to a model, charged per token, on every failure — is not. If that is deliberate, the reasoning belongs next to `classify`.

Found in the branch review of 2026-09-21. Deliberately separated from the confirmed defects so that neither waits on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The sizes real platformOS error bodies reach are measured and recorded in this task, covering at least a 4xx from the app_builder API, a 5xx from the instance, and a failure from an intermediary such as a proxy or CDN
- [ ] #2 A decision on whether an error body needs a bound is recorded, with the measurement as its justification
- [ ] #3 If a bound is added, it keeps the part of the body that carries the reason for the failure, and a test proves an oversized body is still readable enough for an agent to act on
- [ ] #4 If a bound is added, it is applied in one place rather than per tool, consistent with how classify already works
- [ ] #5 If no bound is added, the reasoning is recorded next to classify so the question is not reopened without new evidence
<!-- AC:END -->
