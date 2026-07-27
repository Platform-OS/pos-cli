---
id: TASK-1.10
title: >-
  dns migrate: bulk --backup <dir> overwrites all cohort backups when the
  directory does not exist
status: Done
assignee: []
created_date: '2026-07-23 19:05'
updated_date: '2026-07-24 09:55'
labels:
  - code-review
  - dns
dependencies: []
references:
  - bin/pos-cli-dns-migrate.js
  - bin/pos-cli-dns-export.js
parent_task_id: TASK-1
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in code review of the dns-migration branch.

In bulk cohort mode (--mapping-file/--instances-file), `backupPathFor` (bin/pos-cli-dns-migrate.js:23-28) only treats the --backup value as a directory if it already exists on disk. When the operator passes `--backup exports/` and that directory does not exist yet, every pair resolves to the same literal file path and each instance's source export overwrites the previous one — a cohort migration finishes with one backup instead of N, silently. The backup is the rollback artifact of the migration tool, so silent loss matters.

`dns export` already handles this correctly: in bulk mode it unconditionally treats -o as a directory and creates it (bin/pos-cli-dns-export.js:51-52). Migrate's bulk mode should behave the same way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In bulk mode, --backup <path> produces one backup file per source instance whether or not <path> existed beforehand
- [x] #2 Single-pair behavior (default filename, explicit file path, existing directory) is unchanged
- [x] #3 A test covers bulk backup with a not-yet-existing directory
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix validated, but bulk mode itself was PARKED 2026-07-24 on the dns-migration-bulk branch (not in the current release). The fix ships with bulk whenever that branch lands; single-mode backupPathFor behavior is unaffected.
<!-- SECTION:NOTES:END -->
