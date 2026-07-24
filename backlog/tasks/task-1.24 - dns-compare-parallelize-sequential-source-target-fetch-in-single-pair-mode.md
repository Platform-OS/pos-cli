---
id: TASK-1.24
title: 'dns compare: parallelize sequential source/target fetch in single-pair mode'
status: Done
assignee: []
created_date: '2026-07-24 09:02'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'bin/pos-cli-dns-compare.js:108'
parent_task_id: TASK-1
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that in `bin/pos-cli-dns-compare.js`, single-pair compare (lines 108-123) does `const source = await loadSide(sourceEnv, ...)` then `const target = await loadSide(targetEnv, ...)` sequentially. Each `loadSide` call does its own `resolvePortalContext` + `fetchDomains` against a different portal — these are independent network round-trips.

The bulk-mode branch a few lines above (lines 74-77) already parallelizes the same kind of fetch with `Promise.all`. Running the two sides sequentially in single-pair mode roughly doubles wall-clock latency for `pos-cli dns compare <source> <target>` versus the bulk path, for no benefit, and leaves the file internally inconsistent about whether independent portal fetches should be parallelized.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Single-pair dns compare fetches source and target sides concurrently via Promise.all, matching the bulk-mode code path in the same file
- [x] #2 No behavior change other than latency: existing single-pair compare tests continue to pass unchanged
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
bin/pos-cli-dns-compare.js's single-pair branch now fetches source and target sides concurrently via Promise.all (matching the bulk-mode branch), instead of two sequential awaits. No behavior change other than latency — full unit suite still passes.
<!-- SECTION:FINAL_SUMMARY:END -->
