---
id: TASK-52
title: >-
  MCP: no request has a timeout, so a slow instance holds a tool until the
  client gives up
status: Done
assignee: []
created_date: '2026-09-22 12:55'
updated_date: '2026-09-23 21:17'
labels:
  - mcp
  - robustness
dependencies: []
modified_files:
  - lib/apiRequest.js
  - mcp-min/page/fetch.js
  - test/unit/apiRequest.test.js
  - CLAUDE.md
  - CHANGELOG.md
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
- [x] #1 A request that gets no response fails with a bounded wait rather than hanging, and the bound is decided in one place rather than per tool
- [x] #2 The bound does not break the calls that are legitimately long: a deploy push, an asset upload, waitForUnpack
- [x] #3 A timed-out request reaches the caller as kind `unavailable` with the host in `details`, the way ECONNREFUSED and ETIMEDOUT already do
- [x] #4 `page-fetch` inherits it rather than carrying its own
- [x] #5 A test drives a fetch that never resolves and asserts the call comes back, with fake timers rather than a real wait
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Done. The three open questions this task left are answered from measurement rather than preference.

## What kind of timeout

**Time to first byte, not a whole-response deadline.** The timer is cleared the moment response headers arrive, so reading a slow body is never cut off. `AbortSignal.timeout` — the obvious tool — is a whole-response deadline, and would abort precisely the transfers that are working.

Implemented as an `AbortController` combined with the caller's signal through `AbortSignal.any`, so cancelling still works and the two causes stay distinguishable.

## One bound or two

**Two, both in one module.** A request whose body is a file cannot be answered until the upload has finished, so an ordinary bound would cut off a release archive on a slow link — the one thing AC #2 forbids. `carriesAFile` matches exactly what `buildFormData` turns into a file part, and the two are noted as having to agree.

- `RESPONSE_TIMEOUT_MS` = 5 min — the largest bound this repository already uses (`RELEASE_TIMEOUT_MS`).
- `UPLOAD_TIMEOUT_MS` = 15 min — a 50MB archive is minutes on a slow link.
- `timeoutMs` overrides either, for a caller that knows better.

**These are backstops, not latency targets, and the numbers were chosen against measurement**: a full 39-test suite — the longest synchronous call in the system — answers in **2.4s**. Picking something tighter and more "useful" would have risked breaking a large user test suite that works today, which is the worse failure.

## Reaching the caller correctly

A timeout is thrown as `RequestError` with `code: 'ETIMEDOUT'`, which is already in `classify`'s unreachable set. Verified end to end:

```
kind   : unavailable
code   : ETIMEDOUT
message: No response in 300s: https://fk-block.ps-01-platformos.com did not answer
details: {"host":"https://fk-block.ps-01-platformos.com"}
```

The query string is stripped to the origin, which is the existing rule about what reaches the model on a failure.

## Scope found while doing it

- **`page-fetch` did not use `apiRequest` at all** — it calls `fetch` directly. AC #4 says it must inherit rather than carry its own, so the deadline helper is exported and shared. It runs a page's Liquid, so it is the likeliest request in the system to hang.
- **`waitForUnpack` and the S3 upload also use `fetch` directly** and are bounded by their own loops, so they are untouched — which is what AC #2 asks for.

## Verification

Seven new tests in `test/unit/apiRequest.test.js`, on **fake timers** as AC #5 requires, against a `fetch` that never resolves and rejects the way a real one does when its signal aborts.

Bite-checked, all five caught:

| Breakage | Failed |
| --- | --- |
| the deadline not applied (the filed defect) | 4 |
| one bound for everything, so an upload is cut off | 1 |
| no `ETIMEDOUT`, so `classify` cannot name the host | 1 |
| the timer never cleared | 1 |
| a caller cancellation reported as a timeout | 1 |

This changes shared CLI code, so both suites were run: `test/unit` 1360 passing and `mcp-min` 1616 passing, each with only its known pre-existing failure (TASK-9's `modules.test.js`, and the load-dependent `http-mcp-endpoint` body-limit case that fails on a clean tree too).

**Checked live as well, because a timeout that breaks ordinary work is worse than none**: against fk-block, `deploy-start` with an asset upload (release 23345, 2,074ms), `job-status` waiting to `completed`, `graphql-exec`, `liquid-exec`, `page-fetch` on a page, and `page-fetch` pulling a 270KB asset body — all unaffected. Instance restored to empty afterwards.

The invariant is written into `CLAUDE.md` beside the network-error rules, since the next person adding a request has to know the bound is on the answer and not the transfer.
<!-- SECTION:FINAL_SUMMARY:END -->
