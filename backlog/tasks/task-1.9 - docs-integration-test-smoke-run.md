---
id: TASK-1.9
title: docs + integration test + smoke run
status: Done
assignee: []
created_date: '2026-07-23 09:14'
updated_date: '2026-07-23 09:44'
labels:
  - dns
dependencies:
  - TASK-1.8
parent_task_id: TASK-1
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
README command docs, CHANGELOG entry. Env-var-gated test/integration/dns.test.js: export->import->compare round-trip between two staging instances. Manual smoke per plan: export partners.platformos.com (read-only) -> migrate --dry-run -> live migrate onto ps-pos01 test instance (townhall.platformos.dev) -> compare --ignore-status -> post-cutover refresh + clean compare.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README documents all four subcommands + migration sequence (migrate -> cutover -> refresh -> compare)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
README (DNS section before Data), CHANGELOG Unreleased entry, env-gated test/integration/dns.test.js done. Live-write smoke onto ps-pos01 (townhall instance) was blocked by the local sandbox permission classifier - needs an interactive run; offline dry-run + live read-only export against partners.platformos.com + self-compare all verified.
<!-- SECTION:NOTES:END -->
