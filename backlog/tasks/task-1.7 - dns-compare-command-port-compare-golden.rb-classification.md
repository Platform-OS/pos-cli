---
id: TASK-1.7
title: 'dns compare command: port compare-golden.rb classification'
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 09:34'
labels:
  - dns
dependencies:
  - TASK-1.4
parent_task_id: TASK-1
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/compare.js compareInstance(src,tgt,{transform:true,ignoreStatus}) -> {results, totals}; levels OK/ADVISORY/CRITICAL/MISSING_BEFORE/MISSING_AFTER. Default cross-stack mode: source normalized through transform first, data_center mismatch skipped; --raw = exact golden-file semantics (partner-portal scripts/pp-dns/ps-sg/compare-golden.rb). CRITICAL: status (unless --ignore-status), setup_type, intent records after normalization, verification-record shape/value. ADVISORY: live-vs-intent drift, NS churn, has_pending. Exit 1 on CRITICAL/MISSING. bin/pos-cli-dns-compare.js: --source-file/--target-file offline mode, --domain, --raw, --ignore-status, --json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fixture pair per classification branch incl. MX case-fold => OK and TXT chunk-join => OK; exit-code contract
<!-- AC:END -->
