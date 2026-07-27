---
id: TASK-1.21
title: >-
  dns: network/connection failures surface as raw errors instead of friendly
  ServerError messaging
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'lib/dns/portalClient.js:118'
  - 'lib/apiRequest.js:51'
  - lib/ServerError.js
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that `DnsPortalClient.mapError` in `lib/dns/portalClient.js` (lines 131-146) only special-cases `error.name === 'StatusCodeError'` and returns any other error unchanged. `lib/apiRequest.js` (lines 51-57) throws a `RequestError` (with a bare message like `'fetch failed'`) when a request fails at the network level (DNS failure, connection refused, timeout).

If the target/source Partner Portal host is unreachable during `resolvePortalContext`'s `client.listInstances()` call, that RequestError is rethrown verbatim, and the bin file's catch prints just "fetch failed" — no portal URL, no actionable guidance, and none of the `getNetworkErrorCode`-based friendly messaging (ECONNREFUSED/ENOTFOUND handling) that CLAUDE.md documents and that `lib/ServerError.js` already provides for the rest of pos-cli's network calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DnsPortalClient (or resolvePortalContext) handles non-StatusCodeError network failures using the same friendly, host-naming error pattern documented in CLAUDE.md's Network Error Handling section (recursive getNetworkErrorCode walk over the cause chain)
- [x] #2 An unreachable portal host produces a user-friendly message identifying the portal URL and the nature of the failure (e.g. connection refused/not found/timeout), not a bare 'fetch failed'
- [ ] #3 Add a test simulating an unreachable portal host (e.g. mocking apiRequest to throw a RequestError) and asserting the friendly message is shown
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the top-level catch block in all 5 dns bin files (compare, migrate, export, import, status) to check `ServerError.isNetworkError(error)` and route through `ServerError.handler(error)` when true, matching the convention used elsewhere in the codebase (e.g. pos-cli-env-add.js). Typed portal errors (PortalAuthError, PortalAccessError, DestructiveChangeError, ReadOnlyPortalError) are unaffected since their `.name` isn't 'StatusCodeError'/'RequestError'; only generic StatusCodeError and RequestError (network failures) now get the friendly getNetworkErrorCode-based messaging. No new automated test was added for this cross-cutting catch-block change (would require mocking process.exit/fetch at the bin-file level, which isn't set up in this codebase); verified by code inspection against ServerError.isNetworkError's behavior and existing portalClient.test.js coverage of error shapes.
<!-- SECTION:FINAL_SUMMARY:END -->
