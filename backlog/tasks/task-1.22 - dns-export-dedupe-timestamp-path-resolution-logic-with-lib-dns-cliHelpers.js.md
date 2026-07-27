---
id: TASK-1.22
title: 'dns export: dedupe timestamp/path-resolution logic with lib/dns/cliHelpers.js'
status: Done
assignee: []
created_date: '2026-07-24 09:01'
updated_date: '2026-07-24 09:12'
labels: []
dependencies: []
references:
  - 'bin/pos-cli-dns-export.js:13'
  - lib/dns/cliHelpers.js
parent_task_id: TASK-1
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Code review found that `bin/pos-cli-dns-export.js` reimplements logic that already exists in `lib/dns/cliHelpers.js`, which was specifically introduced as "shared helpers for the dns bin files":

- `defaultFilename` (lines 13-14) re-derives the same timestamp format as cliHelpers.js's `timestamp()` (`new Date().toISOString().replace(/[:.]/g, '-')`)
- `resolveOutPath` (lines 16-22) re-implements the same existsSync/statSync-isDirectory branching as the non-bulk branch of cliHelpers.js's `backupPathFor()`
- The bulk `outDir` default (line 51) duplicates the timestamp format a second time

If the timestamp format or the "existing directory" resolution rule ever needs to change (e.g. a Windows path fix, or a new naming convention), a maintainer updating cliHelpers.js won't notice this file's export filenames silently drifting out of sync with dns migrate's backup filenames.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bin/pos-cli-dns-export.js imports and uses lib/dns/cliHelpers.js's timestamp()/backupPathFor() (or an equivalent shared helper) instead of reimplementing the same logic
- [x] #2 No behavior change: existing dns export tests (default filename, existing-directory resolution, bulk outDir default) continue to pass unchanged
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the local defaultFilename/resolveOutPath functions from bin/pos-cli-dns-export.js; it now imports and uses lib/dns/cliHelpers.js's backupPathFor() (identical filename/directory-resolution behavior, verified byte-for-byte equivalent) and timestamp() for the bulk outDir default. No behavior change — full unit suite still passes.
<!-- SECTION:FINAL_SUMMARY:END -->
