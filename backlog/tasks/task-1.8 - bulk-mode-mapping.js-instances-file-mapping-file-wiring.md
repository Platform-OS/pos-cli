---
id: TASK-1.8
title: 'bulk mode: mapping.js + --instances-file/--mapping-file wiring'
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-24 09:55'
labels:
  - dns
dependencies:
  - TASK-1.6
parent_task_id: TASK-1
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/mapping.js: CSV source_uuid,target_uuid[,label] or JSON array; --match-by-domain resolves target uuid via searchInstances (mismatch errors, never guesses). Sequential per-instance loop with small delay (sidekiq/CF pacing), per-instance backup in --backup dir, summary table label|domains|applied|blocked|errors; exit 1 any errors, exit 3 only-destructive-blocked. Wire --instances-file into export, --mapping-file into migrate/compare.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 cohort run produces per-instance backups + summary; exit codes distinguish errors vs destructive-blocked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PARKED 2026-07-24: bulk cohort mode (mapping.js, --instances-file/--mapping-file/--match-by-domain) removed from the dns-migration release branch — preserved on the dns-migration-bulk branch for a later release.
<!-- SECTION:NOTES:END -->
