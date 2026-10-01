---
id: TASK-27
title: >-
  MCP: make a tool failure impossible to get wrong — one typed error, one
  envelope, built where the tool is dispatched
status: Done
assignee: []
created_date: '2026-09-18 19:06'
updated_date: '2026-09-18 21:40'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/protocol/server-factory.js
  - mcp-min/http-server.js
  - mcp-min/migrations/list.js
  - mcp-min/generators/list.js
  - mcp-min/generators/run.js
  - mcp-min/instructions.js
  - docs/MCP_TOOLS.md
priority: high
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A failed migration is reported to the client as a **successful call**. Measured:

```
migrations-list with a gateway that throws 401
  → {"status":"error","error":{"code":"MIGRATIONS_LIST_ERROR","message":"401 Unauthorized"}}
  → isError = false
```

`mcp-min/protocol/server-factory.js` derives the protocol's failure signal from one predicate, `result?.ok === false`. Thirty-one tools answer `{ ok, ... }` and satisfy it. Four do not: `migrations-list`, `migrations-run` and `migrations-generate` answer `{ status: 'ok' | 'error' }`, where `ok` is `undefined` and the derivation therefore produces the wrong protocol answer; `generators-list` answers `{ generators: [...] }` with no status field at all and swallows a per-generator failure into empty argument lists.

WHY NOT SIMPLY MAKE THE FOUR MATCH THE OTHER THIRTY-ONE. That fixes today's instance and leaves the cause. The envelope is a convention that nothing enforces: four tools drifted from it and nobody noticed until the server instructions needed the sentence "every tool answers with ok" to be true. The same shape is also hand-built over and over — 104 `ok: false` literals, 27 tools constructing `startedAt`/`finishedAt`, 13 rebuilding the same masked `meta.auth` block — which is the same duplication TASK-23.2 removed from the descriptions, in the results.

THE DESIGN: a tool says what went wrong; the dispatch layer decides how that looks.

- A typed error (`mcp-min/tool-error.js`): `throw new ToolError(code, message, details?)` is how a tool reports a failure it understands — a 401, an empty archive, a job on another instance. Nothing else in a tool constructs an envelope.
- One invoker used by every dispatch site. It times the call, builds `meta`, returns the handler's data as `{ ok: true, data, meta }`, turns a `ToolError` into `{ ok: false, error: { code, message, details }, meta }`, and turns anything else thrown into the same shape under `INTERNAL_ERROR` — so an unexpected throw is still a well-formed result rather than a stack trace.
- `isError` stays derived from `ok === false`, in the one place it already is. With the invoker in front of every handler, that derivation is finally always right.

There are three dispatch sites today: `server-factory.js:94` (both SDK transports) and `http-server.js:186` and `:292` (the deprecated `POST /call` and JSON-RPC `tools/call`). The deprecated ones call handlers directly and answer a thrown error with HTTP 500 and `String(err)`, which loses the code and reports a domain failure as a server fault; they must go through the invoker too. `generators-run` also calls `generators-help`'s handler internally (`generators/run.js:25`) — after this, an inner `ToolError` propagates and surfaces with its own code instead of being flattened.

SCOPE. This touches every tool, and the conversion has to be complete rather than gradual: an invoker that wraps a handler's return as `{ ok: true, data }` would double-wrap a tool still returning its own envelope, and a layer that sniffs which shape it got is the ambiguity this removes. The work is mechanical and the tool tests already exist.

THE SHAPE, DECIDED. `ok` is a boolean, not `status: 'ok' | 'error'`. An enum invites a third value, and every candidate third value belongs somewhere else: "accepted, still running" is already `ok: true` with a `job_id`, and the work's state has its own vocabulary in `job-status`; "the tests failed" is `ok: true` with the failures in `data`, because the run did what was asked. A boolean can only answer the one question the envelope is for — did this call do what was asked. It is also what thirty-one of the thirty-five tools already use, it is the inverse of MCP's own `isError`, and it reads the way `Response.ok` does.

The success side needs the same treatment, and it is the half that is easy to miss: twenty-six tools put the payload under `data`, `graphql-exec` and `liquid-exec` use `result`, `deploy-start` adds `archive` and `assets` beside `data`, `unit-tests-run` adds `raw`, and five more return the payload at the top level under no key at all. An agent still has to know per tool where to look, which is the same defect as the failure signal, only quieter. One key: `data`.

That makes the body a breaking change for anyone reading it directly — callers of the deprecated `POST /call` routes, which return the raw result. It is worth doing now rather than at the next major: those routes are removed then anyway, the MCP body is read by a model rather than parsed by brittle code, and carrying two shapes until then means shipping the instructions' hedge for another release. Error codes do not change: they are what an agent branches on.

Once this lands, the server instructions can state the rule plainly. They currently hedge — "a tool reports its own failure inside the result, usually as ok:false" — and that "usually" exists only to stay truthful about these four (TASK-23.3).

Deliberately out of scope: `outputSchema` / `structuredContent`. It is the MCP-native way to make a result shape contractual, but it publishes a second schema per tool in every `tools/list`, and two tasks were just spent taking 22% out of that payload. Worth revisiting for a tool whose output an agent must parse exactly; not for thirty-five.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every tool answers with the same envelope: `{ ok: true, data, meta }` on success, `{ ok: false, error: { code, message, details? }, meta }` on failure, and nothing else at the top level
- [x] #2 The success payload is always under `data` — `graphql-exec` and `liquid-exec` no longer use `result`, and the tools that return `archive`, `assets` or `raw` beside `data` fold them into it
- [x] #3 A migration that fails reaches the client as a failed tool call, on every transport, and a test drives a failing migration end to end rather than asserting the handler's return
- [x] #4 A tool reports a failure it understands by throwing a typed error carrying a code, and no tool module constructs a result envelope itself
- [x] #5 Every dispatch site runs handlers through the same invoker, so `isError` is derived in exactly one place and cannot disagree between transports
- [x] #6 The deprecated HTTP routes report a tool's own failure as that tool's failure, with its code, rather than as an HTTP 500 with a stringified error
- [x] #7 An unexpected throw from a handler still produces a well-formed result with an INTERNAL_ERROR code, and never a stack trace to the client
- [x] #8 A tool that invokes another tool's handler surfaces the inner error's code rather than flattening it
- [x] #9 Each tool keeps the error codes it has today, since those are what an agent branches on
- [x] #10 `startedAt`, `finishedAt` and the masked auth block are built once by the invoker, not in each tool
- [x] #11 A test over the whole registry fails if a tool returns a shape the invoker does not produce, so a thirty-sixth envelope cannot be invented
- [x] #12 The server instructions state the result rule without the "usually" that the current inconsistency forces
- [x] #13 docs/MCP_TOOLS.md's response-pattern section matches what every tool returns, and the changelog records the renamed keys as a breaking change for callers of the deprecated routes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`mcp-min/tool-error.js` (closed `kind` set) and `mcp-min/run-tool.js` (the one invoker) are the whole
design. A tool returns its data or throws a `ToolError`; `ok`, the error body and `meta` are built in
one place, for all three dispatch sites (`protocol/server-factory.js`, and both deprecated routes in
`http-server.js`).

Removed: 104 hand-written `ok: false` literals, 27 copies of `startedAt`/`finishedAt`, 13 rebuilds of
the masked auth block, and ~20 catch-all codes (`DEPLOY_START_ERROR`, `MIGRATIONS_LIST_ERROR`,
`CONSTANTS_SET_FAILED`) that each covered a rejected token, an unreachable instance and a pos-cli bug
under one string. `classify()` now decides the kind from the status or network code.

Found while converting:
- `resolveAuth` threw plain `Error`s, so "environment not found in .pos" classified as `internal` —
  a pos-cli defect. Now `not_found` / `ENV_NOT_FOUND`.
- `authForJob` can redirect to a different `.pos` entry, but `ctx.resolvedAuth` still held what
  `resolveAuth` returned first, so `meta.auth` would have named the wrong environment.
- The migrations tools had no behavioural test at all — which is how they kept their own envelope
  for a release. `mcp-min/__tests__/migrations.test.js` covers the 401, an unreachable instance and
  a refused run.

A handler that still returns an envelope is rejected with `DOUBLE_ENVELOPE` rather than silently
wrapped in a second one: that is the shape a half-finished conversion takes, and it is otherwise
invisible.

`tool-envelope.test.js` derives its file list from the registry's own imports and asserts that count
against `registry.size`, so it cannot quietly scan nothing. It strips comments and matches `{ ok:` —
the envelope's syntax, not the word — after three false-positive rounds: library modules whose `{ok}`
is their callers' business (`data/validate.js`, `host-validation.js`), a comment describing the bug,
and `graphql-exec`'s description string, which tells the model errors come back as ok:false.

Mutants run on the architecture, all killed: double-envelope guard removed, 401 → internal,
unreachable → internal, a tool rebuilding its envelope.
<!-- SECTION:NOTES:END -->
