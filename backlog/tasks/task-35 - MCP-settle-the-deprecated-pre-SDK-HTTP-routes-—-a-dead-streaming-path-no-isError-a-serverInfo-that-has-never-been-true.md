---
id: TASK-35
title: >-
  MCP: settle the deprecated pre-SDK HTTP routes — a dead streaming path, no
  isError, a serverInfo that has never been true
status: Done
assignee: []
created_date: '2026-09-21 12:11'
updated_date: '2026-09-21 13:59'
labels:
  - mcp
  - http
dependencies: []
references:
  - mcp-min/http-server.js
  - mcp-min/sse.js
  - mcp-min/protocol/server-factory.js
  - mcp-min/protocol/http-endpoint.js
  - CLAUDE.md
  - CHANGELOG.md
modified_files:
  - mcp-min/http-server.js
  - mcp-min/sse.js
  - mcp-min/tools-config.js
  - mcp-min/profiles.js
  - CHANGELOG.md
  - CLAUDE.md
  - README.md
  - AGENTS.md
  - mcp-min/README.md
  - docs/MCP_TOOLS.md
  - docs/MCP_COVERAGE.md
  - mcp-min/__tests__/http.test.js
  - mcp-min/__tests__/sse.test.js
  - mcp-min/__tests__/transport-validation.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - mcp-min/__tests__/http-exposure.test.js
  - mcp-min/__tests__/http-shutdown.test.js
  - mcp-min/__tests__/cli-invocation.test.js
  - mcp-min/__tests__/log-redaction.test.js
  - mcp-min/__tests__/list-envs.test.js
  - mcp-min/__tests__/instructions.test.js
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`/`, `/tools`, `/call` and `/call-stream` in `mcp-min/http-server.js` predate the SDK. CLAUDE.md says they are "removed in a future major" — wording deliberately weakened from "the next major" and left undecided. Three things about them are wrong today, and the first is the argument for settling the removal rather than patching again.

**1. `/call-stream`'s tool path can no longer do anything.** It dispatches on `entry.streamHandler`, and no registered tool has one — verified across all 30. `mcp-min/logs/stream.js`, the last tool that did, was deleted earlier in this branch. Every non-JSON-RPC POST to that route now completes the SSE handshake and immediately writes `event: error` / `tool has no streamHandler`. Meanwhile `GET /` still advertises `call_stream` in its `endpoints` map as a working SSE endpoint, so a client is invited to use a route that cannot answer. That is roughly fifty lines of handler plus the `endpoint`/`endpoint_info` handshake, maintained for a capability that no longer exists.

**2. The JSON-RPC `tools/call` branch never marks a failure.** `mcp-min/http-server.js:292` wraps the result in `{ content: [{ type: 'text', text }] }` with no `isError`, whatever `runTool` returned. `/mcp` marks the identical result `isError: true`. A client on the deprecated route reads every failed tool call as a successful one and has to parse the text to discover otherwise — exactly what "tool failures are tool results, not protocol errors" was introduced to stop.

**3. `initialize` reports a server that does not exist.** `mcp-min/http-server.js:247` answers `serverInfo: { name: 'mcp-min', version: '0.1.0' }`. `SERVER_INFO` in `mcp-min/protocol/server-factory.js` is `{ name: 'pos-cli-mcp', version: pkg.version }`. The hardcoded pair has never matched the package and cannot start matching on its own.

The decision this task needs before any code moves: do these routes ship in the release that removes the six deprecated tools, or survive it? If they go, all three items go with them and the work is a deletion plus a breaking-change note. If they stay, all three are live bugs to be fixed on their own terms — and the dead streaming path should still go, because advertising an endpoint that answers nothing is worse than not having it.

Whoever takes this should also confirm no pos-cli code, test fixture or documented client still depends on the pre-SDK routes; `/mcp` is the replacement for all of them.

Found in the branch review of 2026-09-21.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The release is 6.6.0, and every version string that names it agrees: REMOVED_TOOLS, profiles.js, the docs and the test comments
- [x] #2 The pre-SDK HTTP API is gone: GET /, GET /tools, POST /call and POST /call-stream all answer 404, and GET /health and POST /mcp are unchanged
- [x] #3 sse.js, the SSE session registry and the JSON body parser go with the routes, since nothing else used them
- [x] #4 CHANGELOG.md records the removal under Removals and names /mcp as the replacement, and no other entry still promises those routes survive this release
- [x] #5 Every document that described the routes as still served says what actually ships: README, CLAUDE.md, mcp-min/README.md, docs/MCP_TOOLS.md, docs/MCP_COVERAGE.md, AGENTS.md
- [x] #6 No per-tool example in docs/MCP_TOOLS.md invokes a route that no longer exists, and the runnable workflow scripts use /mcp and job-status rather than removed routes and removed tools
- [x] #7 Coverage the deprecated-route tests carried is kept where it still applies, and no test is left passing vacuously against a 404
- [x] #8 The loopback bind, Host/Origin validation and bind-failure reporting are unchanged, and their tests still pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The release is **6.6.0** (the user's call) and the routes are gone. The conditional acceptance
criteria this task was filed with are replaced by the ones it was actually done against.

`http-server.js` went from 403 lines to 116. With the routes went `sse.js`, the `sseSessions`
registry, `generateSessionId`, the `express.Router`, and six imports that existed only for them —
`bodyParser`, `findTool`, `rejectionFor`, `OPEN_OBJECT_SCHEMA`, `runTool` and `buildInstructions`.
What is left is the bind, the request log, the Host/Origin check, `/mcp` and `/health`.

`/health` **stays**. It is not pre-SDK and the README never listed it as deprecated; it is also the
probe every Host/Origin case in `http-exposure.test.js` is driven through, and `http-startup`,
`http-shutdown` and `cli-invocation` all use it to ask whether a listener is up without speaking
the protocol.

**Version strings.** `REMOVED_TOOLS` and `profiles.js` said "7.0.0"; both now say 6.6.0, as do the
four test comments that quoted them. Those strings reach a user as a warning when a
`MCP_TOOLS_CONFIG` file names a removed tool, so they had to match whatever the release is called.

**Two changelog entries contradicted the removal** and were fixed rather than left: the
`logs/stream.js` entry said `/call-stream` "goes at the next major", and the result-envelope entry
told script authors to adapt to a new shape on `POST /call` — routes this release deletes.

**Tests.** 44 failed at first. Deleted: `http.test.js` (nine of its ten tests drove the removed
routes; its `/health` case is duplicated in `http-startup.test.js`) and `sse.test.js`. Reworked
onto `/mcp` rather than dropped, because the property still holds and is worth holding:

- `http-exposure`: "rejects before the body is read" (there is no body parser now, so the control
  proves the SDK would otherwise have read and objected to it), the dispatch-from-an-allowed-page
  case, and a streaming-response case. The route matrix keeps `/health`, `/mcp`, `GET /` and an
  unknown path — `/` is still worth probing precisely because it is no longer a route.
- `log-redaction`: the parameter test now asserts something stronger. The old route logged
  parameter *names*; nothing on `/mcp` logs arguments at all, so the test is that no value of any
  argument reaches the log, while the outcome still does.
- `cli-invocation` and `http-shutdown`: the drain tests now use a `/mcp` call in flight and a
  `subscriptions/listen` stream.

**Two tests were passing vacuously** and would have stayed green while testing nothing:
`http-shutdown`'s "ends a POST /call-stream tool stream" and "ends the GET / SSE stream" both
opened a request that now 404s, so the connection closed immediately and the assertion held. Both
deleted; the `/mcp` describe in that file already covers an in-flight call and a tracked stream.

**Docs.** `docs/MCP_TOOLS.md` had 45 `curl … /call` examples. The per-tool ones became the `name`
and `arguments` of a `tools/call` — the part that actually differs per tool, with the envelope
stated once at the top — and the runnable workflow scripts moved to `/mcp` behind a small `mcp()`
helper that unwraps the SSE frame. Those scripts were doubly stale: one polled `data-import-status`
and another `data-export-status`, tools this release removes, so they now use `job-status` with
`wait_ms` and the polling loops are gone. `mcp-min/README.md` lost a whole section describing the
removed API to cagent, plus the SSE framing section.

**Verified against a running server** (ephemeral port, since 5910 was in use — the bind-failure
message reported that correctly): `/health` 200, `/`, `/tools`, `/call`, `/call-stream` all 404,
`/mcp` lists 30 tools, and a bad `Host` still answers 403.

1344 mcp-min tests pass across 59 files; `test/unit` unchanged at 1317 with the pre-existing
TASK-9 failure.
<!-- SECTION:NOTES:END -->
