---
id: TASK-52
title: >-
  MCP: no request has a timeout, so a slow instance holds a tool until the
  client gives up
status: To Do
assignee: []
created_date: '2026-09-22 12:55'
labels:
  - mcp
  - robustness
dependencies: []
priority: medium
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`lib/apiRequest.js` passes no timeout to `fetch`, and `mcp-min/page/fetch.js` does not either. Every tool that talks to an instance therefore waits indefinitely on a response that never arrives.

For the CLI this is tolerable: a person watching a terminal can press Ctrl-C. For the MCP server it is not the same situation — the process is long-lived, answers concurrently, and `ctx.signal` only fires when the client cancels or disconnects, which an agent waiting on a tool result does not do.

`page-fetch` is the sharpest case and the reason this was noticed during the TASK-40–46 review. It is the only tool that requests an arbitrary path, and a GET on a platformOS page runs that page's Liquid — a page with a slow query or an infinite loop in it is exactly the thing an agent points this at, and exactly the thing that will not answer.

Nothing was changed for it in the review, on purpose: adding a timeout to one tool while every other request in the repository has none is the inconsistency, not the fix. The decision belongs one level up, in `apiRequest`.

Open questions for whoever takes this:
- One timeout, or a longer one for the calls that are legitimately slow (a deploy push, `waitForUnpack`)?
- Is it a connect timeout, a headers timeout, or a whole-response deadline? `AbortSignal.timeout` gives the last, which would break a large upload.
- A timeout has to reach `classify` as `unavailable` with the host named, like `ETIMEDOUT` does now.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A request that gets no response fails with a bounded wait rather than hanging, and the bound is decided in one place rather than per tool
- [ ] #2 The bound does not break the calls that are legitimately long: a deploy push, an asset upload, waitForUnpack
- [ ] #3 A timed-out request reaches the caller as kind `unavailable` with the host in `details`, the way ECONNREFUSED and ETIMEDOUT already do
- [ ] #4 `page-fetch` inherits it rather than carrying its own
- [ ] #5 A test drives a fetch that never resolves and asserts the call comes back, with fake timers rather than a real wait
<!-- AC:END -->
