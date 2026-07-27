---
id: TASK-1.13
title: 'dns: unify and document exit codes across import/migrate single and bulk modes'
status: Done
assignee: []
created_date: '2026-07-23 19:05'
updated_date: '2026-07-23 19:20'
labels:
  - code-review
  - dns
dependencies: []
references:
  - bin/pos-cli-dns-migrate.js
  - bin/pos-cli-dns-import.js
  - README.md
parent_task_id: TASK-1
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in code review of the dns-migration branch.

The dns commands have a deliberate exit-code contract for scripts/CI — 0 success, 1 apply/compare failures, 2 transform errors, 3 blocked-destructive — but it is applied inconsistently and documented nowhere:

- Single-pair migrate exits 2 on transform errors (bin/pos-cli-dns-migrate.js:191), and import does the same, but bulk migrate collapses the same condition to 1 (bin/pos-cli-dns-migrate.js:253, `anyTransformErrors ? 1 : ...`).
- The README dns section only mentions "exit 1 on CRITICAL" for compare; the 0/1/2/3 contract for import/migrate is undocumented.

Scripts driving cohort migrations need the same condition to yield the same code in both modes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The same failure condition produces the same exit code in single-pair and bulk migrate modes
- [x] #2 Exit codes for import, migrate, and compare are documented in the README dns section
- [x] #3 Tests assert exit codes for the transform-error and blocked-destructive paths
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
exitCodeFor + exitCodeForOutcomes in lib/dns/cliHelpers.js; bulk migrate now maps pair-level transform errors to 2 like single mode (1 outranks 2 outranks 3 when mixed). README dns section documents 0/1/2/3 for import/migrate and 0/1 for compare. Contract tests in cliHelpers.test.js.
<!-- SECTION:NOTES:END -->
