---
id: TASK-22
title: >-
  MCP: the SDK handler's close() is never called, so shutdown relies on a body
  sniff
status: To Do
assignee: []
created_date: '2026-09-18 06:28'
labels:
  - mcp
  - lifecycle
dependencies: []
references:
  - mcp-min/protocol/http-endpoint.js
  - mcp-min/http-server.js
  - mcp-min/lifecycle.js
priority: low
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the branch review (2026-09-18), verified against `node_modules/@modelcontextprotocol/server@2.0.0`.

`createMcpHandler` returns `{ fetch, notify, bus, close }`. `close()` marks the handler closed so late requests are refused, runs `listenRouter.closeAll()` and closes every per-request `McpServer` still in `inflight`. `createMcpEndpoint` (`mcp-min/protocol/http-endpoint.js:63-67`) uses only `fetch`, and `startHttp` never registers anything with `shutdown.onShutdown` for `/mcp`.

Teardown currently works by side effect: `stopHttp` destroys the responses registered with `trackStream`, `pipeline` propagates the destroy into `Readable.fromWeb(response.body)`, and the SDK's stream is cancelled. That depends on `opensSubscription` — a sniff of the request body for `subscriptions/listen` — being the complete set of long-lived responses, and it leaves in-flight modern per-request servers unclosed.

Nothing observable is wrong today (the shutdown tests pass, and the SDK's keep-alive timers are unref'd, so nothing holds the process), which is why this is filed rather than fixed: the change is small but it moves the teardown path that TASK-15's tests were written against.

Proposed: `createMcpEndpoint` returns `{ endpoint, close }`, `startHttp` registers `close` with the shutdown, and `stopHttp` awaits it — then the body sniff is only about which responses shutdown must end, not about which the SDK knows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 stopHttp calls the MCP handler's close(), and a request arriving after shutdown began is refused by the SDK rather than reaching a tool
- [ ] #2 The shutdown tests still pass without relying on opensSubscription to find long-lived responses
<!-- AC:END -->
