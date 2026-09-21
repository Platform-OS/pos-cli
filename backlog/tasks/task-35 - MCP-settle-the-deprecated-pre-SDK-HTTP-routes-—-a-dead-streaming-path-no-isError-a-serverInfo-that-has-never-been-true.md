---
id: TASK-35
title: >-
  MCP: settle the deprecated pre-SDK HTTP routes — a dead streaming path, no
  isError, a serverInfo that has never been true
status: To Do
assignee: []
created_date: '2026-09-21 12:11'
updated_date: '2026-09-21 12:12'
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
- [ ] #1 A decision on whether the deprecated HTTP routes ship in the next major is recorded in CHANGELOG.md and CLAUDE.md, worded the same way in both
- [ ] #2 No route advertises a capability the server cannot provide
- [ ] #3 The unreachable streamHandler dispatch and its SSE handshake are gone, whether or not the surrounding routes stay
- [ ] #4 If the routes stay: a failed tool call over the deprecated JSON-RPC path is marked as an error the same way /mcp marks it, asserted by a test that runs against both paths
- [ ] #5 If the routes stay: one definition of the server's name and version serves every transport, asserted by a test
- [ ] #6 If the routes go: CHANGELOG.md names /, /tools, /call and /call-stream under a breaking-change heading and documents /mcp as the replacement
- [ ] #7 No test is left asserting the behaviour of a route or dispatch branch that no longer exists
- [ ] #8 Host/Origin validation, the loopback bind and the bind-failure reporting are unaffected either way, and their tests still pass unchanged
- [ ] #9 The version these deprecations name is settled and consistent: mcp-min/tools-config.js REMOVED_TOOLS and mcp-min/profiles.js both assert "7.0.0" today, and those strings reach users as warnings, so they either match the release or are changed with it
<!-- AC:END -->
