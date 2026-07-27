---
id: TASK-1.4
title: 'normalize.js + transform.js: pure record transform (TDD)'
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 18:27'
labels:
  - dns
dependencies:
  - TASK-1.3
parent_task_id: TASK-1
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TESTS FIRST. lib/dns/normalize.js (TXT unquote + 255-byte chunk join, MX host case-fold, name lowercase, record sort - shared with compare). lib/dns/transform.js: transformDomain(sourceDomain,{targetInstanceUuid}) -> {payload, kept, dropped:[{record,reason}], errors, warnings}; transformEnvelope; deriveEnableWwwRedirect/deriveSetupType/deriveUseAsDefault/primaryDomains. Source of truth = attributes.config.extra_dns_records (customer records ONLY - no platform filtering). Only DROP rule: www-><domain> CNAME when enable_www_redirect derives true. Old-infra values (elb.amazonaws.com etc) KEEP + warn; --drop-value regex escape hatch. Validate to new-stack rules: type whitelist, multi-value CNAME/ALIAS hard error, MX/SRV shape, proxied:false default, ttl 3600 default.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 failing tests written first over sanitized fixtures; www-redirect drop only when derived true; old-infra kept+warned; multi-value CNAME errors; transform idempotent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD red run (module-not-found) before implementation; all AC cases in transform.test.js/normalize.test.js incl. idempotency test added during AC review 2026-07-23.
<!-- SECTION:NOTES:END -->
