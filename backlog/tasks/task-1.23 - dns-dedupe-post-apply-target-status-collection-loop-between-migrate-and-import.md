---
id: TASK-1.23
title: >-
  dns: dedupe post-apply target-status collection loop between migrate and
  import
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'bin/pos-cli-dns-migrate.js:72'
  - 'bin/pos-cli-dns-import.js:86'
parent_task_id: TASK-1
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that the exact same loop — collecting post-apply target domain statuses via `for (const result of results.filter(entry => entry.status === 'applied')) { targetStatuses.push(result.domainStatus || await client.getDomain(...).catch(() => null)) }` — appears verbatim (only variable names changed) in both `bin/pos-cli-dns-migrate.js` (lines 72-78) and `bin/pos-cli-dns-import.js` (lines 86-92).

A future fix (e.g. retry logic, or additional invariant checks in the style of task-1.15) applied to one copy but not the other would leave `dns import` and `dns migrate` silently diverging in how cutover instructions are computed after what's documented as the same apply step.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The post-apply target-status collection loop is extracted into a single shared helper (e.g. in lib/dns/cliHelpers.js or lib/dns/apply.js) used by both bin/pos-cli-dns-migrate.js and bin/pos-cli-dns-import.js
- [x] #2 No behavior change: existing migrate and import tests continue to pass unchanged
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted the post-apply target-status collection loop into `collectAppliedTargetStatuses(client, targetUuid, results)` in lib/dns/apply.js, used identically by both bin/pos-cli-dns-migrate.js and bin/pos-cli-dns-import.js. Added unit tests in apply.test.js covering the domainStatus-reuse path, the --no-wait re-fetch path, and a failed re-fetch resolving to null.
<!-- SECTION:FINAL_SUMMARY:END -->
