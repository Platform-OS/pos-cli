---
id: TASK-1.5
title: 'dns import command + apply engine (dry-run, destructive guard, polling)'
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 09:28'
labels:
  - dns
dependencies:
  - TASK-1.4
parent_task_id: TASK-1
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/plan.js (KEEP/DROP/ERROR dry-run table, chalk+text-table). lib/dns/apply.js applyPlans({client, plans, confirmDestructive, wait}): sequential POSTs (one provision worker each - no stampede), NEVER auto-set confirm_destructive; DestructiveChangeError -> 'blocked-destructive' + suggest --confirm-destructive, no retry; poll getDomain every 5s until locked===false && status!=='initializing' (cap 120s); ownership_verification_pending = expected success pre-cutover. bin/pos-cli-dns-import.js: --file --dry-run --confirm-destructive --domain --no-wait --json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dry-run POSTs nothing, exit 2 on transform errors; destructive 422 blocked without auto-retry; idempotent re-run
<!-- AC:END -->
