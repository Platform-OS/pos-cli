---
id: TASK-1.18
title: >-
  dns migrate: bulk backups scatter across per-pair timestamped directories
  instead of one shared cohort dir
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'lib/dns/cliHelpers.js:22'
  - 'bin/pos-cli-dns-migrate.js:33'
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that `backupPathFor()` in `lib/dns/cliHelpers.js:22` generates a fresh timestamp on every call: `const dir = (!backup || backup === true) ? \`dns-backups-${timestamp()}\` : backup;`.

`migratePair` (bin/pos-cli-dns-migrate.js:33) calls `backupPathFor(params.backup, sourceUuid, { bulk })` once per pair. When running bulk `dns migrate` (`--instances-file`/`--mapping-file`, `--match-by-domain`) without an explicit `--backup` flag, every pair in the cohort gets a different `dns-backups-<timestamp>/` directory (since each pair's export/transform takes at least a second), rather than the single shared cohort directory that `dns export`'s bulk mode already produces (by computing `outDir` once, before its loop). For a 20-instance cohort this leaves 20 differently-named top-level directories with one backup file each, and no single place to find/restore "the backup for this migration run".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bulk `dns migrate` without an explicit --backup uses one shared timestamped directory computed once for the whole bulk run, matching the pattern already used by dns export's bulk mode
- [x] #2 Each pair's backup file is written into that single shared directory rather than a per-pair directory
- [x] #3 Explicit --backup <dir> behavior (single directory when it exists) is unchanged
- [x] #4 Add/update a test simulating multiple pairs in a bulk migrate run and asserting all backups land in the same directory
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `resolveBulkBackupDir()` to lib/dns/cliHelpers.js, called once in bin/pos-cli-dns-migrate.js before the per-pair loop; the resolved directory is threaded into each migratePair() call via an overridden `params.backup`, so backupPathFor() receives an already-concrete directory string per pair instead of regenerating `dns-backups-<timestamp>` on every call. Explicit --backup <dir> and --no-backup behavior unchanged. Added unit tests in cliHelpers.test.js.
<!-- SECTION:FINAL_SUMMARY:END -->
