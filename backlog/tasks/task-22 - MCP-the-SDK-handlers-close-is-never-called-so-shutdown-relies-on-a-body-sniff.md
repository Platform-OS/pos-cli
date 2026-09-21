---
id: TASK-22
title: >-
  MCP: the SDK handler's close() is never called, so shutdown relies on a body
  sniff
status: Done
assignee: []
created_date: '2026-09-18 06:28'
updated_date: '2026-09-21 19:08'
labels:
  - mcp
  - lifecycle
dependencies: []
references:
  - mcp-min/protocol/http-endpoint.js
  - mcp-min/http-server.js
  - mcp-min/lifecycle.js
modified_files:
  - mcp-min/http-server.js
  - mcp-min/protocol/http-endpoint.js
  - mcp-min/__tests__/http-shutdown.test.js
  - mcp-min/__tests__/http-shutdown-handler.test.js
  - CLAUDE.md
  - CHANGELOG.md
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
- [x] #1 stopHttp calls the MCP handler's close(), after the drain rather than at the start of one, and a request arriving once shutdown has begun does not reach a tool
- [x] #2 The shutdown tests still pass, and what opensSubscription is relied on for is written down
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The constraint the task did not know about

`close()` cannot simply be called first. The SDK's own type says it **"aborts in-flight modern
exchanges and closes their per-request instances"** — and this shutdown is a *drain*, whose whole
point (`lifecycle.js`) is that in-flight calls write their responses. Calling it at the start of
`stopHttp` aborts exactly the calls the drain exists to answer, and
`http-shutdown.test.js > a call in flight is answered` fails. That is bite check 2 below, and it is
why the proposed one-liner is not the fix.

So the two things the original AC #1 asked for happen at opposite ends:

- **`state.closing` is set first**, and `createMcpEndpoint` is given `isClosing`. A `/mcp` request
  arriving after that is answered `503` and never reaches a tool. `server.close()` stops new
  *connections*, but a connection that was mid-request when shutdown began can still carry another,
  and that one would otherwise start work the drain then has to wait for.
- **`close()` runs after the drain**, chained onto the `server.close()` promise, so `stopHttp`
  resolves only once the handler is closed too. A rejection there is logged, not propagated: the
  listener is already down, and `index.js` awaits this promise, so a rejection would be reported as
  a failed shutdown.

AC #1 said "refused by the SDK". It is refused *before* the SDK instead, which is the same outcome
for the caller and the only version compatible with the drain. The AC was reworded to say what was
actually required rather than which layer does it.

## AC #2, honestly

**`opensSubscription` stays, and the original wording could not be met.** The sniff is what finds
the responses shutdown must *destroy*, and that job cannot move to `handler.close()`: those
responses are what hold the drain open, so they have to be ended **before** the drain finishes,
which is exactly when `close()` must not run. Two tests confirm the sniff still does its job
(`ends a subscriptions/listen stream`, and the drain test).

What did change is that it is no longer doing a second job by accident. `close()` now releases the
per-request servers and the listen router; the sniff is only about which responses shutdown must
end. That is the distinction the task's own "Proposed" paragraph was reaching for.

## Tested

`mcp-min/__tests__/http-shutdown-handler.test.js` (new, 5 tests) stubs the endpoint so the wiring
and the order are testable without the protocol: the endpoint learns shutdown began and not before,
`close()` is called after the last response and not during it, a second `stopHttp` does not close
twice, and a rejecting `close()` still resolves the shutdown.

`http-shutdown.test.js` gains two against the real handler: `close()` stops it serving, so a call
after it never reaches the tool (the SDK answers *"This MCP handler has been closed"*), and a
request while `isClosing` is `503` with the tool untouched.

**One test was written and thrown away.** A version driving the refusal through the real transport,
pipelining a second request onto a busy socket, received nothing at all: after the first response
finishes, `res.on('finish')` schedules `closeIdleConnections()`, and Node destroys the connection
before it dispatches the pipelined request. So through the real transport a late pipelined request
is usually dropped with its connection rather than answered — the safety property (no tool runs)
holds either way, but the test was racy and did not test what it claimed. Removed rather than kept
green. **A second one was vacuous** — it claimed to test a rejecting `close()` without ever making
one reject, and asserted a local nothing wrote; rewritten.

Three bite checks, both files restored against their sha256: `close()` never called → 3 fail;
`close()` called at the start → 2 fail, **including the real drain test**; no `isClosing` guard → 1
fail.

mcp-min: 1395 passing across 60 files.

## On a real process

`pos-cli-mcp --profile dev` on port 5931: `/health` 200, stdin closed → **exit 0 after 21 ms**,
`HTTP server on http://127.0.0.1:5931 closed` logged, port `ECONNREFUSED` afterwards.
<!-- SECTION:NOTES:END -->
