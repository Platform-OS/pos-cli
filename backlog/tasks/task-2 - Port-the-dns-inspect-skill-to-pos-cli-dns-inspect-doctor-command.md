---
id: TASK-2
title: Port the dns-inspect skill to pos-cli (dns inspect / doctor command)
status: To Do
assignee: []
created_date: '2026-07-23 17:09'
labels:
  - dns
dependencies: []
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port partner-portal's in-repo dns-inspect skill (dig/curl battery, DNS provider detection, record-set variants per setup_type, CF error 1014 / cert / stuck-status triage) into pos-cli as e.g. `pos-cli dns inspect <environment> [--domain <name>]`. Unlike the skill, pos-cli has authenticated access to the REAL domain config via the portal /api/domains (setup_type, intent records, dns_verification_records, private_lb_cname/lb_public_ip, status/substatus) - so instead of inferring what the records SHOULD be, it can compare live public DNS (dig/DoH) against the portal's expected record set and produce precise, actionable instructions ('your _acme-challenge CNAME points at the OLD stack's DCV target, replace with X'). Building blocks already in lib/dns/: portalClient, cutover.js STATUS_MEANINGS, normalize.js, compare.js classification. Reference: partner-portal dns-inspect skill + docs/doc-1 (apex/www CH layout per setup_type and www-redirect mode).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pos-cli dns inspect <env> [--domain] resolves live DNS (A/CNAME/NS/_acme-challenge) and diffs against the portal's expected records for the domain's setup_type
- [ ] #2 Detects the common failure signatures: CNAME pointing at old stack, missing/stale DCV records, NS not repointed (domain-full), CF 1014 cross-user, ECH/underscore Android quirks noted
- [ ] #3 Outputs per-domain verdict + copy-pasteable fix instructions; --json for support tooling
<!-- AC:END -->
