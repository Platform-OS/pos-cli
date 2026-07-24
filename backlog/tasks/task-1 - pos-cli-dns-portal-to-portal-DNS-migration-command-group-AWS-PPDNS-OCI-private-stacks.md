---
id: TASK-1
title: >-
  pos-cli dns: portal-to-portal DNS migration command group (AWS/PPDNS -> OCI
  private stacks)
status: Done
assignee: []
created_date: '2026-07-23 09:12'
updated_date: '2026-07-23 14:48'
labels:
  - dns
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella task. Customers migrating instances from the legacy AWS shared stack (partners.platformos.com, frozen/read-only) to OCI private-stack portals need DNS records migrated. Build pos-cli dns export/import/migrate/compare doing API-to-API migration via both portals' /api/domains (contracts verified compatible; .pos Doorkeeper tokens authenticate). extra_dns_records contains ONLY customer records - no platform-record filtering needed; transform = validation/normalization + www-redirect handling. After import, print per-domain cutover instructions (domain-full: NS repoint; domain-external: DCV records + CNAME/A retarget). Full design: partner-portal repo plan /home/godot/.claude/plans/ppdns-is-still-running-wondrous-hellman.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 R1 pre-check done: authenticated GET /api/domains?version=2 against deployed partners.platformos.com confirms v2 attrs (or v1 fallback implemented)
- [x] #2 All child tasks completed; npm run test:unit green
- [x] #3 Manual smoke: export from partners.platformos.com, dry-run + live migrate onto ps-pos01 test instance, compare --ignore-status clean
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final validation 2026-07-23 after TASK-50/51 (+81058 follow-up, commit 0e68866b) deployed to ps-pos01: migrate aws->ps succeeded end-to-end against the CF-restored zone (APPLIED, last_operation_status 'apply completed', reparking_domain = expected pre-NS-cutover, cutover instructions printed curt/mina.ns.cloudflare.com); zone has 18/18 unique records (adoption, no duplicates); compare aws ps --ignore-status: Critical 0, only advisory = status ready vs reparking_domain (expected until registrar NS cutover). 83 unit tests green. Live-details compare now normalizes CF read-side noise (TXT quoting, hostname case).
<!-- SECTION:NOTES:END -->
