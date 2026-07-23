---
id: TASK-1.3
title: dns export command + versioned export schema
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 09:21'
labels:
  - dns
dependencies:
  - TASK-1.2
parent_task_id: TASK-1
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/exportSchema.js: envelope schema 'pos-cli/dns-export/v1' {schema, exported_at, portal_url, api_version, instance{uuid,url,env}, domains[] verbatim minus details.state (old-stack Terraform blob)}; buildEnvelope/stripBulkyDetails/validateEnvelope. bin/pos-cli-dns.js group + bin/pos-cli-dns-export.js leaf; register in bin/pos-cli.js + package.json bin map. Flags: -o out|dir, --instance-uuid, --api-version (v2 default, auto-fallback v1 deriving name from config._domains[0]), --raw. Export doubles as backup/audit artifact and fixture-capture tool.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 export against a live portal produces valid envelope; details.state stripped; unknown-major rejected on read
<!-- AC:END -->
