---
id: TASK-37
title: >-
  MCP: measure what an upstream error body costs in a tool result, then decide
  whether it needs a bound
status: Done
assignee: []
created_date: '2026-09-21 12:12'
updated_date: '2026-09-21 14:56'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/run-tool.js
  - mcp-min/redact.js
  - mcp-min/protocol/server-factory.js
  - lib/apiRequest.js
modified_files:
  - mcp-min/tool-error.js
  - mcp-min/__tests__/tool-envelope.test.js
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
- [x] #1 The sizes real platformOS error bodies reach are measured and recorded in this task, covering at least a 4xx from the app_builder API, a 5xx from the instance, and a failure from an intermediary such as a proxy or CDN
- [x] #2 A decision on whether an error body needs a bound is recorded, with the measurement as its justification
- [x] #3 If a bound is added, it keeps the part of the body that carries the reason for the failure, and a test proves an oversized body is still readable enough for an agent to act on
- [x] #4 If a bound is added, it is applied in one place rather than per tool, consistent with how classify already works
- [x] #5 If no bound is added, the reasoning is recorded next to classify so the question is not reopened without new evidence
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured against a real platformOS instance (a test instance the user provided), read-only
requests only.

**What an upstream error body actually is** — the value `classify` copies into `details.body`:

| failure | status | body | shape |
|---|---|---|---|
| token rejected | 401 | **27 B** | text — `HTTP Token: Access denied.` |
| graph over GET | 400 | **10 B** | text — `BadRequest` |
| app_builder path with no route | 404 | **1,430 B** | HTML — `Aw, Snap!` |
| release that does not exist | 503 | **2,062 B** | HTML — `Oops (503)` |

**And what the model receives** — the whole serialised result:

| call | whole result | of which body |
|---|---|---|
| `constants-list`, valid (a success, for scale) | 999 B | — |
| `constants-list`, token rejected | 512 B | 27 B |
| `liquid-exec`, template that does not compile | 914 B | 0 B |
| `graphql-exec`, syntax error | 738 B | 0 B |
| `job-status`, release that does not exist | **2,597 B** | **2,062 B** |

Two things the measurement settled that guessing would not have:

1. **Most failures carry no body at all.** GraphQL and Liquid errors come back `200` with the
   problem in the payload, so the tool reads them and `classify` never sees a `response.body`.
   The unbounded path is narrower than the task assumed.
2. **The worst observed result is 2.6 KB**, about 2.6× a small success. Not the problem the task
   suspected.

**Decision: a ceiling, but only on a body that is not JSON, set at 4,096 — above everything
measured.** `apiRequest` parses the body as JSON when it can, so `typeof body === 'string'` is
exactly "the instance or something in front of it sent a page instead". Parsed JSON is never cut:
it is small, structured, and it is what carries the `file_path` a failed deploy names — truncating
it would hand the model a string that no longer parses.

The head is kept, not the tail, because that is where the reason is: `<title>Oops (503)</title>`
sits in the first 200 bytes of both pages measured.

So this changes nothing observable. Re-measured against the instance after the change: every
number identical, including the 2,597 B worst case. That is deliberate — 2 KB does not justify
cutting anything, and what does justify the ceiling is the tail a single healthy instance cannot
show us (a CDN's 502, an application backtrace), where the body is whatever someone else chose to
send. The reasoning is recorded on `MAX_ERROR_BODY_LENGTH` in `tool-error.js`, beside `classify`.

**Bite check**, sha256-verified restore: reverting `boundedBody` to the raw body fails "a page far
larger than the ceiling is cut".

Four tests: oversized page is cut and says how much was dropped; what survives still contains the
reason and the status; a realistic body is untouched; a JSON body is never cut however long.

1348 mcp-min tests pass.
<!-- SECTION:NOTES:END -->
