---
id: TASK-1.6
title: dns migrate command + cutover instructions
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 09:30'
labels:
  - dns
dependencies:
  - TASK-1.5
parent_task_id: TASK-1
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/cutover.js cutoverInstructions(targetDomain): domain-full -> registrar NS list from details.dns_zone_name_servers; domain-external -> DCV records from details.dns_verification_records/dcv_delegation_record + point CNAME to details.private_lb_cname (apex -> A lb_public_ip); print status/substatus plain-English meaning; call refreshDomain after apply. bin/pos-cli-dns-migrate.js [srcEnv] [tgtEnv]: source client constructed readOnly; backup file ALWAYS written before any POST (--backup, --no-backup); --dry-run --confirm-destructive --domain --source/target-{portal-url,token,email,instance-uuid}. Mirrors clone-init two-env UX.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 migrate on test instance prints correct cutover block per setup_type; backup written before first POST
<!-- AC:END -->
