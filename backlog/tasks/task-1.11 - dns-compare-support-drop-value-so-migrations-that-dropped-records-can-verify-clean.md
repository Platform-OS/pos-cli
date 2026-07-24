---
id: TASK-1.11
title: >-
  dns compare: support --drop-value so migrations that dropped records can
  verify clean
status: Done
assignee: []
created_date: '2026-07-23 19:05'
updated_date: '2026-07-23 19:20'
labels:
  - code-review
  - dns
dependencies: []
references:
  - bin/pos-cli-dns-compare.js
  - lib/dns/compare.js
  - lib/dns/transform.js
parent_task_id: TASK-1
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in code review of the dns-migration branch.

`dns migrate` and `dns import` accept a repeatable `--drop-value <regex>` option to intentionally drop records during the transform, but `dns compare` runs the transform without drop patterns (lib/dns/compare.js:57 calls transformDomain with no dropValuePatterns; bin/pos-cli-dns-compare.js has no such option). Any record dropped at migration time is therefore reported as CRITICAL "missing on target" forever, and compare exits 1.

The documented workflow (README dns section: "migrate → complete the cutover steps → compare comes back clean") can never succeed for domains migrated with --drop-value, which also breaks CI usage of compare's exit code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dns compare accepts the same repeatable --drop-value option as migrate/import and excludes matching source records from the intent comparison
- [x] #2 A migration performed with --drop-value X followed by compare with --drop-value X reports OK for the affected domains
- [x] #3 README compare section documents the option
- [x] #4 Unit tests cover drop-value filtering in compare
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
compareInstance accepts dropValuePatterns, applied symmetrically in intentFor (same path as the www-redirect drop). --drop-value wired into both compare modes (single + --mapping-file bulk). README compare section documents it. Test: CRITICAL without pattern, OK with the migration's pattern.
<!-- SECTION:NOTES:END -->
